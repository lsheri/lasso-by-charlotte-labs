import { useRef, useState } from "react";

import {
  enclosedRuns,
  snippetFromRuns,
  unionBBox,
  type BBox,
  type Point,
  type TextRun,
} from "@/lib/lasso-geometry";
import { MIN_SNIPPET_CHARS } from "@/lib/span-provenance-shared";

export const EMPTY_LASSO_LINE =
  "Nothing readable inside this lasso. Circle text, or switch to Text view to select it.";

/**
 * The ink over one rendered page. The path a person draws decides the span: the
 * runs it encloses become the snippet, and an empty circle is a truthful
 * outcome that costs nothing, not an error and not a model call.
 */
export function LassoLayer({
  armed,
  runs,
  width,
  height,
  reduceMotion,
  wrapped,
  resolving,
  onLasso,
  onEmpty,
}: {
  armed: boolean;
  runs: TextRun[];
  width: number;
  height: number;
  reduceMotion: boolean;
  /** The rect the ink settled on, kept while the ask card is open. */
  wrapped: BBox | null;
  resolving: boolean;
  onLasso: (result: { snippet: string; box: BBox }) => void;
  onEmpty: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [path, setPath] = useState<Point[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [empty, setEmpty] = useState(false);

  function at(event: React.PointerEvent): Point {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }

  function finish() {
    setDrawing(false);
    const polygon = path;
    setPath([]);
    if (polygon.length < 3) return;
    const inside = enclosedRuns(runs, polygon);
    const snippet = snippetFromRuns(inside);
    const box = unionBBox(inside);
    if (snippet.length < MIN_SNIPPET_CHARS || !box) {
      setEmpty(true);
      onEmpty();
      return;
    }
    setEmpty(false);
    onLasso({ snippet, box });
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
          setEmpty(false);
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
        {path.length > 1 ? (
          <polyline
            data-testid="lasso-path"
            points={path.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {wrapped ? (
          <rect
            data-testid="lasso-wrap"
            x={wrapped.x - 4}
            y={wrapped.y - 3}
            width={wrapped.w + 8}
            height={wrapped.h + 6}
            rx={6}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            className={
              reduceMotion
                ? `nb-lasso-static${resolving ? " nb-lasso-resolving-static" : ""}`
                : `nb-lasso-wrap${resolving ? " nb-lasso-resolving" : ""}`
            }
          />
        ) : null}
      </svg>
      {empty ? (
        <p className="absolute inset-x-0 bottom-1 z-10 px-2 text-center text-xs text-muted-foreground">
          {EMPTY_LASSO_LINE}
        </p>
      ) : null}
    </>
  );
}
