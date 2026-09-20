import { useEffect, useRef, useState } from "react";

import { loadPdfjs } from "@/lib/pdfjs-client";
import type { WorkboardFilePreview as FilePreview } from "@/lib/workboard-card-preview.shared";

function FirstPdfPage({ url, onFailure }: { url: string; onFailure: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let document: { destroy: () => Promise<void> } | null = null;
    void (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const pdf = await pdfjs.getDocument({ url }).promise;
        document = pdf;
        const page = await pdf.getPage(1);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(1.5, (canvas.parentElement?.clientWidth ?? 208) / base.width) });
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) setReady(true);
      } catch (error) {
        if (!cancelled && (error as Error).name !== "RenderingCancelledException") onFailure();
      }
    })();
    return () => {
      cancelled = true;
      try { renderTask?.cancel(); } catch { /* cancellation is expected */ }
      void document?.destroy();
    };
  }, [onFailure, url]);

  return <canvas ref={canvasRef} data-ready={ready} className="canvas-lab-file-preview-canvas" />;
}

export function WorkboardFilePreview({ preview, onFailure }: { preview: FilePreview; onFailure: () => void }) {
  if (preview.kind === "pdf" && preview.url) return <FirstPdfPage url={preview.url} onFailure={onFailure} />;
  if (preview.kind === "slide") {
    return <div data-testid="workboard-slide-preview" className="canvas-lab-file-preview canvas-lab-slide-preview">
      {preview.slideTitle ? <strong>{preview.slideTitle}</strong> : null}
      {preview.lines.map((line, index) => <p key={`${index}:${line}`}>{line}</p>)}
    </div>;
  }
  if (preview.kind === "text") {
    return <div data-testid="workboard-text-preview" className="canvas-lab-file-preview canvas-lab-text-preview">
      {preview.lines.map((line, index) => <p key={`${index}:${line}`}>{line}</p>)}
    </div>;
  }
  return null;
}