import { useEffect, useRef, useState } from "react";

import { loadPdfjs } from "@/lib/pdfjs-client";

const MAX_PAGES = 30;

/**
 * Renders the PDF ourselves rather than trusting the browser's built-in
 * viewer, which a sandboxed frame can refuse to load. Client-only: pdfjs and
 * its worker are imported after mount.
 */
export function PdfView({ url, title }: { url: string; title: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Held in refs so cleanup can cancel an outstanding render and destroy
    // the document, releasing the worker instead of abandoning it.
    const renderTaskRef: { current: { cancel: () => void } | null } = { current: null };
    const docRef: { current: { destroy: () => Promise<void> } | null } = { current: null };
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const doc = await pdfjs.getDocument({ url }).promise;
        docRef.current = doc;
        const host = hostRef.current;
        if (cancelled || !host) return;
        host.replaceChildren();

        for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n += 1) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const scale = Math.min(
            2,
            (host.clientWidth || 720) / page.getViewport({ scale: 1 }).width,
          );
          const viewport = page.getViewport({ scale });
          if (Math.floor(viewport.width) < 1 || Math.floor(viewport.height) < 1) continue;
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "mb-3 w-full rounded-[var(--radius)] border border-border bg-white";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          host.appendChild(canvas);
          const task = page.render({ canvasContext: ctx, viewport });
          renderTaskRef.current = task;
          try {
            await task.promise;
          } catch (e) {
            // A cancelled render is a normal outcome, not a failure.
            if ((e as Error).name === "RenderingCancelledException") return;
            throw e;
          } finally {
            if (renderTaskRef.current === task) renderTaskRef.current = null;
          }
          if (cancelled) return;
          // Show the document as soon as the first page is painted.
          if (n === 1) setReady(true);
        }
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      const task = renderTaskRef.current;
      renderTaskRef.current = null;
      try {
        task?.cancel();
      } catch {
        /* RenderingCancelledException is how a cancelled render reports in */
      }
      const doc = docRef.current;
      docRef.current = null;
      void doc?.destroy();
    };
  }, [url]);

  if (error)
    return <p className="text-sm text-muted-foreground">Couldn&apos;t render this PDF: {error}</p>;

  return (
    <div aria-label={title}>
      <div ref={hostRef} />
      {!ready ? <p className="text-sm text-muted-foreground">Loading preview…</p> : null}
    </div>
  );
}
