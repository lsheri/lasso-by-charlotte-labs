import { useRef, useState } from "react";

import {
  denormalizeInk,
  enclosedRuns,
  inkPathD,
  isDegenerateLasso,
  snippetFromRuns,
  unionBBox,
  type BBox,
  type Point,
  type TextRun,
} from "@/lib/lasso-geometry";
import { MIN_SNIPPET_CHARS } from "@/lib/span-provenance-shared";

export const TRY_AGAIN_TITLE = "That circle didn't catch any words.";
export const TRY_AGAIN_BODY =
  "Draw one loose loop around the fact you want to trace, like circling it with a pencil.";
export const TRY_AGAIN_DISMISS = "Got it";

/**
 * The ink over one rendered page. The path a person draws decides the span: the
 * runs it encloses become the snippet, and the ink itself stays as the mark
 * rather than being replaced by a rectangle. A loop that caught nothing is a
 * truthful outcome that costs nothing, and it says so kindly.
 */
export function LassoLayer({
  armed,
  runs,
  width,
  height,
  reduceMotion,
  settled,
  replays = [],
  resolving,
  onLasso,
  onEmpty,
}: {
  armed: boolean;
  runs: TextRun[];
  width: number;
  height: number;
  reduceMotion: boolean;
  /** The loop the ink settled on, kept while the ask card is open. */
  settled: Point[] | null;
  /** Loops already asked about on this page, redrawn where they were drawn. */
  replays?: { id: string; ink: readonly (readonly [number, number])[]; lit?: boolean }[];
  resolving: boolean;
  onLasso: (result: { snippet: string; box: BBox; firstRunIndex: number; path: Point[] }) => void;
  onEmpty: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [path, setPath] = useState<Point[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [tryAgain, setTryAgain] = useState(false);

  function at(event: React.PointerEvent): Point {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }

  function nudge() {
    setTryAgain(true);
    onEmpty();
  }

  function finish() {
    setDrawing(false);
    const polygon = path;
    setPath([]);
    if (isDegenerateLasso(polygon, width, height)) {
      nudge();
      return;
    }
    const inside = enclosedRuns(runs, polygon);
    const snippet = snippetFromRuns(inside);
    const box = unionBBox(inside);
    if (snippet.length < MIN_SNIPPET_CHARS || !box) {
      nudge();
      return;
    }
    setTryAgain(false);
    const first = inside[0];
    onLasso({ snippet, box, firstRunIndex: first ? runs.indexOf(first) : 0, path: polygon });
  }

  return (
    <>
      <svg
        ref={svgRef}
        data-testid="lasso-layer"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`absolute inset-0 h-full w-full ${armed ? "cursor-crosshair" : "pointer-events-none"}`}
        onPointerDown={(event) => {
          if (!armed) return;
          setTryAgain(false);
          setDrawing(true);
          setPath([at(event)]);
        }}
        onPointerMove={(event) => {
          if (!drawing) return;
          setPath((prev) => [...prev, at(event)]);
        }}
        onPointerUp={() => {
          if (drawing) finish();
        }}
        onPointerLeave={() => {
          if (drawing) finish();
        }}
      >
        {/* The circle is the person's own gesture, drawn in the app's circling green. It deliberately does not use the status colours because a circle says "I picked this", never "this is verified". */}
        {replays.map((replay) => (
          <path
            key={replay.id}
            data-testid={`ink-replay-${replay.id}`}
            data-stitch-id={replay.id}
            d={inkPathD(denormalizeInk(replay.ink, width, height))}
            fill="none"
            stroke="var(--nb-green)"
            strokeOpacity={0.85}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={replay.lit ? (reduceMotion ? "nb-ink-lit-static" : "nb-ink-lit") : ""}
          />
        ))}
        {path.length > 1 ? (
          <path
            data-testid="lasso-path"
            d={inkPathD(path)}
            fill="none"
            stroke="var(--nb-green)"
            strokeOpacity={0.85}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {settled && settled.length > 1 ? (
          <path
            data-testid="lasso-ink"
            d={inkPathD(settled)}
            fill="none"
            stroke="var(--nb-green)"
            strokeOpacity={0.85}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
              reduceMotion
                ? `nb-ink-static${resolving ? " nb-ink-march-static" : ""}`
                : `nb-ink-settle${resolving ? " nb-ink-march" : ""}`
            }
          />
        ) : null}
      </svg>
      {tryAgain ? (
        <div
          data-testid="lasso-try-again"
          className="absolute inset-x-2 bottom-2 z-10 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 shadow-sm"
        >
          <p className="text-xs font-medium text-foreground">{TRY_AGAIN_TITLE}</p>
          <p className="mt-1 text-xs text-muted-foreground">{TRY_AGAIN_BODY}</p>
          <button
            type="button"
            onClick={() => setTryAgain(false)}
            className="mt-1.5 text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
          >
            {TRY_AGAIN_DISMISS}
          </button>
        </div>
      ) : null}
    </>
  );
}
