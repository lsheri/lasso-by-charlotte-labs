import { useEffect, useRef, useState } from "react";

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
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const doc = await pdfjs.getDocument({ url }).promise;
        const host = hostRef.current;
        if (cancelled || !host) return;
        host.replaceChildren();

        for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n += 1) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const scale = Math.min(2, (host.clientWidth || 720) / page.getViewport({ scale: 1 }).width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "mb-3 w-full rounded-[var(--radius)] border border-border bg-white";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          host.appendChild(canvas);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) return <p className="text-sm text-muted-foreground">Couldn&apos;t render this PDF: {error}</p>;

  return (
    <div aria-label={title}>
      <div ref={hostRef} />
      {!ready ? <p className="text-sm text-muted-foreground">Loading preview…</p> : null}
    </div>
  );
}
