import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LassoLayer } from "@/components/provenance/LassoLayer";
import { StitchChip } from "@/components/provenance/StitchChip";
import { Button } from "@/components/ui/button";
import {
  normalizeBBox,
  pageLabel,
  sortReadingOrder,
  type BBox,
  type TextRun,
} from "@/lib/lasso-geometry";
import { makeRenderGuard } from "@/lib/rendition-query";
import type { AuditStitch } from "@/lib/span-provenance.functions";
import {
  countOccurrences,
  findSnippetOffset,
  type SpanLocator,
} from "@/lib/span-provenance-shared";
import { spanStatusClass, spanStatusWash } from "@/lib/span-status-style";

const MAX_PAGES = 60;
const DEFAULT_QUESTION = "Where did this come from?";

export type PageText = { runs: TextRun[]; text: string; offsets: number[] };

/**
 * Runs joined the way a reader reads them, with each run's start offset kept.
 * The runs are put into reading order first, the same order the lasso uses, so
 * a circled snippet is findable in this text and every offset here indexes into
 * the returned `runs` array.
 */
export function joinRuns(input: TextRun[]): PageText {
  const runs = sortReadingOrder(input);
  const offsets: number[] = [];
  let text = "";
  runs.forEach((run) => {
    offsets.push(text.length);
    text += run.text;
    text += " ";
  });
  return { runs, text: text.trim(), offsets };
}

/** The runs covered by a span of the page's joined text. */
export function runsForOffsets(page: PageText, start: number, end: number): TextRun[] {
  return page.runs.filter((run, i) => {
    const from = page.offsets[i] ?? 0;
    return from + run.text.length > start && from < end;
  });
}


/** The rects to highlight for a snippet already asked about on this page. */
export function runsForSnippet(page: PageText, snippet: string, occurrence: number): TextRun[] {
  const found = findSnippetOffset(page.text, snippet, occurrence);
  if (!found) return [];
  return runsForOffsets(page, found.start, found.end);
}

/**
 * Which instance of this wording the ink went around. Counting the whole page
 * would always point at the last one, so the count stops where the enclosed
 * text begins.
 */
export function occurrenceAtOffset(page: PageText, snippet: string, startOffset: number): number {
  const before = page.text.slice(0, Math.max(0, startOffset));
  return countOccurrences(before, snippet) + 1;
}

export type StitchAnchor = { stitch: AuditStitch; page: number; start: number; end: number };

/**
 * Where each stitch actually lands on the rendered pages. A locator that names
 * a page is tried first; anything asked in text view is re-anchored by its
 * wording alone, first page that contains it. A stitch that anchors nowhere is
 * an orphan and is shown as such rather than drawn in a guessed place.
 */
export function anchorStitches(
  pages: Map<number, PageText>,
  stitches: AuditStitch[],
): { anchors: StitchAnchor[]; orphans: AuditStitch[] } {
  const order = [...pages.keys()].sort((a, b) => a - b);
  const anchors: StitchAnchor[] = [];
  const orphans: AuditStitch[] = [];

  stitches.forEach((stitch) => {
    const snippet = stitch.locator?.snippet ?? "";
    if (!snippet) {
      orphans.push(stitch);
      return;
    }
    const named = stitch.locator.index;
    const namedPage = pages.get(named);
    if (namedPage && (stitch.locator.unit === "page" || stitch.locator.unit === "slide")) {
      const hit = findSnippetOffset(namedPage.text, snippet, stitch.locator.occurrence ?? 1);
      if (hit) {
        anchors.push({ stitch, page: named, start: hit.start, end: hit.end });
        return;
      }
    }
    for (const pageNumber of order) {
      const page = pages.get(pageNumber) as PageText;
      const hit = findSnippetOffset(page.text, snippet, 1);
      if (hit) {
        anchors.push({ stitch, page: pageNumber, start: hit.start, end: hit.end });
        return;
      }
    }
    orphans.push(stitch);
  });

  return { anchors, orphans };
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
  anchorId,
  unit,
  stitches,
  armed,
  busy,
  canAsk,
  onAsk,
  onGoToSource,
  onReload,
}: {
  url: string;
  anchorId?: string;
  unit: "slide" | "page";
  stitches: AuditStitch[];
  armed: boolean;
  busy: boolean;
  canAsk: boolean;
  onAsk: (locator: SpanLocator, question: string) => void;
  onGoToSource: (stitch: AuditStitch, origin: DOMRect | null) => void;
  onReload?: () => void;
}) {
  const [doc, setDoc] = useState<unknown>(null);
  const [pages, setPages] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pageTexts, setPageTexts] = useState<Map<number, PageText>>(new Map());
  const [hovered, setHovered] = useState<string | null>(null);
  const reduceMotion = useReduceMotion();

  // The signed url is re-minted on every fetch, so it is read at load time
  // rather than depended on: a new signature for the same bytes must not tear
  // down a document that is already rendered.
  const urlRef = useRef(url);
  urlRef.current = url;
  const docRef = useRef<unknown>(null);
  docRef.current = doc;

  const loadKey = anchorId ?? url;

  useEffect(() => {
    if (docRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const loaded = await pdfjs.getDocument({ url: urlRef.current }).promise;
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
  }, [loadKey, attempt]);

  const reportPage = useCallback((pageNumber: number, text: PageText) => {
    setPageTexts((prev) => {
      const next = new Map(prev);
      next.set(pageNumber, text);
      return next;
    });
  }, []);

  // Text is read for every page as soon as the document opens, even the pages
  // no one has scrolled to. Painting stays lazy; anchoring does not depend on
  // it, so a stitch that belongs on page forty is either drawn there or shown
  // honestly as an orphan instead of quietly disappearing.
  useEffect(() => {
    if (!doc || pages === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
          if (cancelled) return;
          const pdfPage = await (doc as { getPage: (n: number) => Promise<unknown> }).getPage(
            pageNumber,
          );
          const runs = await readPageRuns(pdfjs, pdfPage, 1);
          if (cancelled) return;
          setPageTexts((prev) => {
            if (prev.has(pageNumber)) return prev;
            const next = new Map(prev);
            next.set(pageNumber, joinRuns(runs));
            return next;
          });
        }
      } catch {
        // A text pass that fails leaves painting and the rail as they were.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pages]);


  const reload = useCallback(() => {
    setError(null);
    setDoc(null);
    docRef.current = null;
    setPageTexts(new Map());
    setPages(0);
    onReload?.();
    setAttempt((prev) => prev + 1);
  }, [onReload]);

  const placed = useMemo(() => anchorStitches(pageTexts, stitches), [pageTexts, stitches]);
  const allRendered = pageTexts.size >= pages && pages > 0;

  if (error)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Couldn&apos;t render these pages: {error}</p>
        <Button type="button" size="sm" variant="outline" onClick={reload}>
          Reload pages
        </Button>
      </div>
    );
  if (!doc) return <p className="text-sm text-muted-foreground">Loading pages…</p>;

  return (
    <div className="space-y-6">
      {Array.from({ length: pages }, (_, i) => i + 1).map((pageNumber) => (
        <PdfPage
          key={pageNumber}
          doc={doc}
          pageNumber={pageNumber}
          unit={unit}
          anchors={placed.anchors.filter((anchor) => anchor.page === pageNumber)}
          armed={armed}
          busy={busy}
          canAsk={canAsk}
          reduceMotion={reduceMotion}
          hovered={hovered}
          onHover={setHovered}
          onPageText={reportPage}
          onError={setError}
          onAsk={onAsk}
          onGoToSource={onGoToSource}
        />
      ))}
      {truncated ? (
        <p className="text-xs text-muted-foreground">Showing the first {MAX_PAGES} pages.</p>
      ) : null}

      {allRendered && placed.orphans.length > 0 ? (
        <div
          data-testid="slides-orphan-rail"
          className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-3"
        >
          <p className="micro-label micro-label-field">Previously asked</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This wording is not on any rendered page, so these answers are kept here rather than
            placed in the wrong spot.
          </p>
          {placed.orphans.map((stitch) => (
            <StitchChip
              key={stitch.id}
              stitch={stitch}
              reduceMotion={reduceMotion}
              onGoToSource={(selected) => onGoToSource(selected, null)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PdfPage({
  doc,
  pageNumber,
  unit,
  anchors,
  armed,
  busy,
  canAsk,
  reduceMotion,
  hovered,
  onHover,
  onPageText,
  onError,
  onAsk,
  onGoToSource,
}: {
  doc: unknown;
  pageNumber: number;
  unit: "slide" | "page";
  anchors: StitchAnchor[];
  armed: boolean;
  busy: boolean;
  canAsk: boolean;
  reduceMotion: boolean;
  hovered: string | null;
  onHover: (id: string | null) => void;
  onPageText: (pageNumber: number, text: PageText) => void;
  onError: (message: string) => void;
  onAsk: (locator: SpanLocator, question: string) => void;
  onGoToSource: (stitch: AuditStitch, origin: DOMRect | null) => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState<PageText>({ runs: [], text: "", offsets: [] });
  const [pending, setPending] = useState<{
    snippet: string;
    box: BBox;
    occurrence: number;
    question: string;
  } | null>(null);

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
    const guard = makeRenderGuard();
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const pdfPage = await (doc as { getPage: (n: number) => Promise<never> }).getPage(
          pageNumber,
        );
        const api = pdfPage as unknown as {
          getViewport: (o: { scale: number }) => {
            width: number;
            height: number;
            transform: number[];
          };
          render: (o: unknown) => { promise: Promise<void>; cancel: () => void };
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
          if (ctx) {
            const task = api.render({ canvasContext: ctx, viewport });
            guard.set(task);
            try {
              await task.promise;
            } catch (e) {
              if ((e as { name?: string }).name === "RenderingCancelledException") return;
              throw e;
            } finally {
              guard.set(null);
            }
          }
        }

        const content = await api.getTextContent();
        if (cancelled) return;
        const runs: TextRun[] = [];
        for (const raw of content.items) {
          const item = raw as {
            str?: string;
            transform?: number[];
            width?: number;
            height?: number;
          };
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
        const joined = joinRuns(runs);
        setPage(joined);
        onPageText(pageNumber, joined);
      } catch (e) {
        if (!cancelled) onError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      guard.cancel();
    };
  }, [visible, doc, pageNumber, onPageText, onError]);

  const highlights = useMemo(
    () =>
      anchors.flatMap((anchor) =>
        runsForOffsets(page, anchor.start, anchor.end).map((run) => ({
          id: anchor.stitch.id,
          status: anchor.stitch.status,
          run,
        })),
      ),
    [anchors, page],
  );

  return (
    <section ref={holderRef} data-page={pageNumber} className="space-y-1.5">
      <p className="micro-label micro-label-field">{pageLabel(unit, pageNumber)}</p>
      <div
        ref={wrapRef}
        data-testid={`page-card-${pageNumber}`}
        className={`relative w-full overflow-hidden rounded-[var(--radius)] border border-border bg-white ${
          armed && canAsk ? (reduceMotion ? "nb-page-armed-static" : "nb-page-armed") : ""
        }`}
        style={size.height ? { aspectRatio: `${size.width} / ${size.height}` } : undefined}
      >
        <canvas ref={canvasRef} className="block w-full" />
        <svg
          className="absolute inset-0 h-full w-full"
          style={{ pointerEvents: "none" }}
          viewBox={`0 0 ${size.width || 1} ${size.height || 1}`}
        >
          {highlights.map((entry, i) => (
            <rect
              key={`${entry.id}-${i}`}
              data-stitch-id={entry.id}
              data-testid={`span-rect-${entry.id}`}
              x={entry.run.x}
              y={entry.run.y}
              width={entry.run.w}
              height={entry.run.h}
              rx={2}
              fill={spanStatusWash(entry.status)}
              stroke={hovered === entry.id ? "currentColor" : "none"}
              className={`${spanStatusClass(entry.status)} ${
                reduceMotion ? "nb-span-pulse-static" : "nb-span-pulse"
              } ${hovered === entry.id ? "nb-span-lit" : ""}`}
              style={{ pointerEvents: "auto" }}
              onMouseEnter={() => onHover(entry.id)}
              onMouseLeave={() => onHover(null)}
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
          onLasso={({ snippet, box, firstRunIndex }) =>
            setPending({
              snippet,
              box,
              occurrence: occurrenceAtOffset(page, snippet, page.offsets[firstRunIndex] ?? 0),
              question: DEFAULT_QUESTION,
            })
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
                    occurrence: pending.occurrence,
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

      {anchors.map((anchor) => (
        <StitchChip
          key={anchor.stitch.id}
          stitch={anchor.stitch}
          reduceMotion={reduceMotion}
          lifted={hovered === anchor.stitch.id}
          onHoverChange={(on) => onHover(on ? anchor.stitch.id : null)}
          onGoToSource={(selected: AuditStitch) =>
            onGoToSource(selected, wrapRef.current?.getBoundingClientRect() ?? null)
          }
        />
      ))}
    </section>
  );
}
