import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { resolveMotion } from "@/lib/motion-registry";

export interface SheetCandidate {
  id: string;
  node: React.ReactNode;
}

interface Line {
  id: string;
  index: number;
  d: string;
}

/** Top third heavier, the rest plain. A band, never a number. */
function strokeFor(index: number, total: number): { width: number; opacity: number } {
  if (total > 0 && index < total / 3) return { width: 2.4, opacity: 1 };
  if (total > 0 && index < (total * 2) / 3) return { width: 1.4, opacity: 1 };
  return { width: 1.4, opacity: 0.6 };
}

/**
 * The sheet Find it lays its answer on: the piece of work anchored centre
 * left, what fed it in a column on the right, and one overlay joining them.
 *
 * The joins are measured from the elements themselves with
 * getBoundingClientRect on every layout change. Nothing here reads a grid
 * template: the column can wrap, and a line that assumed a grid would lie.
 */
export function FindItSheet({
  target,
  candidates,
  phase,
  reduce,
}: {
  target: React.ReactNode;
  candidates: SheetCandidate[];
  phase: "reading" | "found";
  reduce: boolean;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [lines, setLines] = useState<Line[]>([]);

  const reading = resolveMotion("findit.reading", reduce);
  const found = resolveMotion("findit.found", reduce);

  const measure = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const base = sheet.getBoundingClientRect();
    setBox({ width: base.width, height: base.height });
    const anchor = targetRef.current?.getBoundingClientRect();
    if (!anchor) {
      setLines([]);
      return;
    }
    const x1 = anchor.right - base.left;
    const y1 = anchor.top + anchor.height / 2 - base.top;
    const next: Line[] = [];
    candidates.forEach((candidate, index) => {
      const element = nodeRefs.current.get(candidate.id);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const x2 = rect.left - base.left;
      const y2 = rect.top + Math.min(rect.height / 2, 42) - base.top;
      const mid = (x1 + x2) / 2;
      next.push({
        id: candidate.id,
        index,
        d: `M${x1.toFixed(1)} ${y1.toFixed(1)}C${mid.toFixed(1)} ${y1.toFixed(1)} ${mid.toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      });
    });
    setLines(next);
  }, [candidates]);

  useLayoutEffect(() => {
    measure();
  }, [measure, phase]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(sheet);
    if (targetRef.current) observer.observe(targetRef.current);
    for (const element of nodeRefs.current.values()) observer.observe(element);
    return () => observer.disconnect();
  }, [measure, candidates]);

  return (
    <div
      ref={sheetRef}
      data-testid="find-it-sheet"
      className="relative rounded-[8px] border border-hairline bg-card p-6 shadow-[var(--shadow-modal)]"
    >
      {box.width > 0 && lines.length > 0 ? (
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
          width={box.width}
          height={box.height}
          viewBox={`0 0 ${box.width} ${box.height}`}
          fill="none"
        >
          {lines.map((line) => {
            const stroke = strokeFor(line.index, lines.length);
            const moving = phase === "reading" ? "nb-findit-comet" : found.className;
            return (
              <g key={line.id} style={{ ["--nb-i" as string]: line.index }}>
                <path
                  pathLength={1}
                  d={line.d}
                  stroke="var(--nb-pencil)"
                  strokeWidth={stroke.width}
                  strokeLinecap="round"
                  opacity={stroke.opacity}
                  className={reduce ? "nb-findit-line-still" : moving}
                />
              </g>
            );
          })}
        </svg>
      ) : null}

      <div className="relative flex flex-wrap items-start gap-8">
        <div ref={targetRef} className="w-[240px] self-center">
          {target}
        </div>
        <div className="flex min-w-[260px] flex-1 flex-col gap-4">
          {candidates.map((candidate, index) => (
            <div
              key={candidate.id}
              ref={(element) => {
                if (element) nodeRefs.current.set(candidate.id, element);
                else nodeRefs.current.delete(candidate.id);
              }}
              className={reduce || index >= 12 ? "" : reading.className}
              style={index < 12 ? ({ ["--nb-i" as string]: index } as React.CSSProperties) : undefined}
            >
              {candidate.node}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
