import { useEffect, useState } from "react";

/**
 * The thread between a wrapped span and the work it came from. Unsourced draws
 * halfway and stops at an open circle: the record showed nothing to reach.
 */
export function ThreadLine({
  from,
  targetId,
  sourced,
  reduceMotion,
}: {
  from: { x: number; y: number };
  targetId: string | null;
  sourced: boolean;
  reduceMotion: boolean;
}) {
  const [to, setTo] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const target = targetId ? document.getElementById(targetId) : null;
      const rect = target?.getBoundingClientRect();
      setTo(rect ? { x: rect.right, y: rect.top + rect.height / 2 } : null);
    }, 60);
    return () => window.clearTimeout(id);
  }, [targetId, from.x, from.y]);

  const end = sourced && to ? to : { x: from.x - 120, y: from.y };

  return (
    <svg
      data-testid="audit-thread"
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
      aria-hidden
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={end.x}
        y2={end.y}
        stroke="var(--accent)"
        strokeWidth={1.5}
        className={reduceMotion ? "nb-thread-static" : "nb-thread-draw"}
      />
      {!sourced ? (
        <circle cx={end.x} cy={end.y} r={4} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
      ) : null}
    </svg>
  );
}
