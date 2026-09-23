import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { loadPdfjs } from "@/lib/pdfjs-client";
import { withPreviewCsp, type WorkboardFilePreview as FilePreview } from "@/lib/workboard-card-preview.shared";

function PdfPages({ url, onFailure, onPageChange }: { url: string; onFailure: () => void; onPageChange?: (() => void) | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let document: { destroy: () => Promise<void> } | null = null;
    void (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const pdf = await pdfjs.getDocument({ url }).promise;
        document = pdf;
        if (!cancelled) setPageCount(pdf.numPages);
        const page = await pdf.getPage(pageNumber);
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
  }, [onFailure, pageNumber, url]);

  return <div className="canvas-lab-document-page"><canvas ref={canvasRef} data-ready={ready} className="canvas-lab-file-preview-canvas" />{pageCount > 0 ? <PageControls page={pageNumber} count={pageCount} onPage={(page) => { setPageNumber(page); onPageChange?.(); }} /> : null}</div>;
}

function PageControls({ page, count, onPage }: { page: number; count: number; onPage: (page: number) => void }) {
  return <div className="canvas-lab-page-controls"><Button type="button" size="icon" variant="ghost" aria-label="Previous page" disabled={page <= 1} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onPage(page - 1); }}><ChevronLeft aria-hidden="true" /></Button><span>Page {page} of {count}</span><Button type="button" size="icon" variant="ghost" aria-label="Next page" disabled={page >= count} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onPage(page + 1); }}><ChevronRight aria-hidden="true" /></Button></div>;
}

export function WorkboardFilePreview({ preview, title, focused = true, onFailure, onPageChange }: { preview: FilePreview; title: string; focused?: boolean; onFailure: () => void; onPageChange?: (() => void) | undefined }) {
  const [slide, setSlide] = useState(1);
  if (preview.kind === "pdf" && preview.url) return <PdfPages url={preview.url} onFailure={onFailure} onPageChange={onPageChange} />;
  if (preview.kind === "html" && preview.html) {
    return <div className="canvas-lab-html-preview">
      <iframe sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={withPreviewCsp(preview.html)} title={title} loading="lazy" data-testid="workboard-html-preview" />
      <div aria-hidden="true" data-testid="workboard-html-preview-overlay" data-focused={focused} className={focused ? "pointer-events-none absolute inset-0" : "absolute inset-0"} />
    </div>;
  }
  if (preview.kind === "slide") {
    const pages = preview.pages?.length ? preview.pages : [{ title: preview.slideTitle, lines: preview.lines }];
    const page = pages[Math.min(slide - 1, pages.length - 1)] ?? pages[0];
    return <div data-testid="workboard-slide-preview" className="canvas-lab-file-preview canvas-lab-slide-preview">
      <div className="canvas-lab-file-page">{page?.title ? <strong>{page.title}</strong> : null}{(page?.lines ?? []).map((line, index) => <p key={`${index}:${line}`}>{line}</p>)}</div>
      <PageControls page={slide} count={pages.length} onPage={(pageNumber) => { setSlide(pageNumber); onPageChange?.(); }} />
    </div>;
  }
  if (preview.kind === "text") {
    return <div data-testid="workboard-text-preview" className="canvas-lab-file-preview canvas-lab-text-preview">
      {preview.lines.map((line, index) => <p key={`${index}:${line}`}>{line}</p>)}
    </div>;
  }
  return null;
}