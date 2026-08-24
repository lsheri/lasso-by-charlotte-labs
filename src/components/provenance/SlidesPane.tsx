import { useEffect, useMemo, useRef, useState } from "react";

import { LassoLayer } from "@/components/provenance/LassoLayer";
import { StitchChip } from "@/components/provenance/StitchChip";
import { Button } from "@/components/ui/button";
import {
  normalizeBBox,
  pageLabel,
  type BBox,
  type TextRun,
} from "@/lib/lasso-geometry";
import type { AuditStitch } from "@/lib/span-provenance.functions";
import { countOccurrences, findSnippetOffset, type SpanLocator } from "@/lib/span-provenance-shared";

const MAX_PAGES = 60;
const DEFAULT_QUESTION = "Where did this come from?";

export type PageText = { runs: TextRun[]; text: string; offsets: number[] };

/** Runs joined the way a reader reads them, with each run's start offset kept. */
export function joinRuns(runs: TextRun[]): PageText {
  const offsets: number[] = [];
  let text = "";
  runs.forEach((run) => {
    offsets.push(text.length);
    text += run.text;
    text += " ";
  });
  return { runs, text: text.trim(), offsets };
}

/** The rects to highlight for a snippet already asked about on this page. */
export function runsForSnippet(
  page: PageText,
  snippet: string,
  occurrence: number,
): TextRun[] {
  const found = findSnippetOffset(page.text, snippet, occurrence);
  if (!found) return [];
  return page.runs.filter((run, i) => {
    const start = page.offsets[i] ?? 0;
    const end = start + run.text.length;
    return end > found.start && start < found.end;
  });
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false);
  }, []);
  return reduce;
}

/**
 * The visual audit: the deliverable's own pages, rendered from the pdf bytes we
 * already store, with the page's own text behind the ink. Nothing here is a
 * stand in for an item that has no pdf.
 */
export function SlidesPane({
  url,
  unit,
  stitches,
  armed,
  busy,
  canAsk,
  onAsk,
  onGoToSource,
}: {
  url: string;
  unit: "slide" | "page";
  stitches: AuditStitch[];
  armed: boolean;
  busy: boolean;
  canAsk: boolean;
  onAsk: (locator: SpanLocator, question: string) => void;
  onGoToSource: (stitch: AuditStitch, origin: DOMRect | null) => void;
}) {
  const [doc, setDoc] = useState<unknown>(null);
  const [pages, setPages] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const loaded = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        setDoc(loaded);
        setPages(Math.min(loaded.numPages, MAX_PAGES));
        setTruncated(loaded.numPages > MAX_PAGES);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error)
    return <p className="text-sm text-muted-foreground">Couldn&apos;t render these pages: {error}</p>;
  if (!doc) return <p className="text-sm text-muted-foreground">Loading pages…</p>;

  return (
    <div className="space-y-6">
      {Array.from({ length: pages }, (_, i) => i + 1).map((pageNumber) => (
        <PdfPage
          key={pageNumber}
          doc={doc}
          pageNumber={pageNumber}
          unit={unit}
          stitches={stitches.filter(
            (stitch) =>
              stitch.locator?.index === pageNumber &&
              (stitch.locator.unit === "page" || stitch.locator.unit === "slide"),
          )}
          armed={armed}
          busy={busy}
          canAsk={canAsk}
          onAsk={onAsk}
          onGoToSource={onGoToSource}
        />
      ))}
      {truncated ? (
        <p className="text-xs text-muted-foreground">Showing the first {MAX_PAGES} pages.</p>
      ) : null}
    </div>
  );
}

function PdfPage({
  doc,
  pageNumber,
  unit,
  stitches,
  armed,
  busy,
  canAsk,
  onAsk,
  onGoToSource,
}: {
  doc: unknown;
  pageNumber: number;
  unit: "slide" | "page";
  stitches: AuditStitch[];
  armed: boolean;
  busy: boolean;
  canAsk: boolean;
  onAsk: (locator: SpanLocator, question: string) => void;
  onGoToSource: (stitch: AuditStitch, origin: DOMRect | null) => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReduceMotion();
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState<PageText>({ runs: [], text: "", offsets: [] });
  const [pending, setPending] = useState<{ snippet: string; box: BBox; question: string } | null>(
    null,
  );

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && setVisible(true)),
      { rootMargin: "400px" },
    );
    observer.observe(holder);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const pdfjs = await import("pdfjs-dist");
      const pdfPage = await (doc as { getPage: (n: number) => Promise<never> }).getPage(pageNumber);
      const api = pdfPage as unknown as {
        getViewport: (o: { scale: number }) => { width: number; height: number; transform: number[] };
        render: (o: unknown) => { promise: Promise<void> };
        getTextContent: () => Promise<{ items: unknown[] }>;
      };
      const base = api.getViewport({ scale: 1 });
      const width = holderRef.current?.clientWidth || 720;
      const scale = Math.min(2, width / base.width);
      const viewport = api.getViewport({ scale });
      if (cancelled) return;
      setSize({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) });

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (ctx) await api.render({ canvasContext: ctx, viewport }).promise;
      }

      const content = await api.getTextContent();
      if (cancelled) return;
      const runs: TextRun[] = [];
      for (const raw of content.items) {
        const item = raw as { str?: string; transform?: number[]; width?: number; height?: number };
        if (!item.str || !item.transform) continue;
        const t = pdfjs.Util.transform(viewport.transform, item.transform) as number[];
        const h = (item.height ?? 10) * scale;
        runs.push({
          text: item.str,
          x: t[4] as number,
          y: (t[5] as number) - h,
          w: (item.width ?? 0) * scale,
          h,
        });
      }
      setPage(joinRuns(runs));
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, doc, pageNumber]);

  const highlights = useMemo(
    () =>
      stitches.flatMap((stitch) =>
        runsForSnippet(page, stitch.locator.snippet, stitch.locator.occurrence ?? 1).map((run) => ({
          id: stitch.id,
          run,
        })),
      ),
    [stitches, page],
  );

  return (
    <section ref={holderRef} data-page={pageNumber} className="space-y-1.5">
      <p className="micro-label micro-label-field">{pageLabel(unit, pageNumber)}</p>
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-[var(--radius)] border border-border bg-white"
        style={size.height ? { aspectRatio: `${size.width} / ${size.height}` } : undefined}
      >
        <canvas ref={canvasRef} className="block w-full" />
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${size.width || 1} ${size.height || 1}`}
        >
          {highlights.map((entry, i) => (
            <rect
              key={`${entry.id}-${i}`}
              x={entry.run.x}
              y={entry.run.y}
              width={entry.run.w}
              height={entry.run.h}
              rx={2}
              fill="var(--accent-soft, rgba(0,0,0,0.08))"
            />
          ))}
        </svg>
        <LassoLayer
          armed={armed && canAsk}
          runs={page.runs}
          width={size.width || 1}
          height={size.height || 1}
          reduceMotion={reduceMotion}
          wrapped={pending?.box ?? null}
          resolving={busy && pending !== null}
          onLasso={({ snippet, box }) =>
            setPending({ snippet, box, question: DEFAULT_QUESTION })
          }
          onEmpty={() => setPending(null)}
        />
      </div>

      {pending ? (
        <div className="rounded-[var(--radius-md)] border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            {pending.snippet.slice(0, 160)}
            {pending.snippet.length > 160 ? "…" : ""}
          </p>
          <textarea
            value={pending.question}
            onChange={(event) =>
              setPending((prev) => (prev ? { ...prev, question: event.target.value } : prev))
            }
            rows={2}
            className="mt-2 w-full resize-none rounded-[var(--radius-md)] border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
          <div className="mt-2 flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => {
                onAsk(
                  {
                    unit,
                    index: pageNumber,
                    snippet: pending.snippet,
                    occurrence: Math.max(1, countOccurrences(page.text, pending.snippet)),
                    bbox: normalizeBBox(pending.box, size.width || 1, size.height || 1),
                  },
                  pending.question.trim() || DEFAULT_QUESTION,
                );
                setPending(null);
              }}
            >
              {busy ? "Reading the record…" : DEFAULT_QUESTION}
            </Button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {stitches.map((stitch) => (
        <StitchChip
          key={stitch.id}
          stitch={stitch}
          onGoToSource={(selected) =>
            onGoToSource(selected, wrapRef.current?.getBoundingClientRect() ?? null)
          }
        />
      ))}
    </section>
  );
}
