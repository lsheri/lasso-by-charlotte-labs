import { useEffect, useState } from "react";

import { useMotion } from "@/hooks/use-motion";
import type { SpanStatus } from "@/lib/span-provenance-shared";
import { spanStatusStroke } from "@/lib/span-status-style";

/** How long a drawn thread stays before it would start lying about position. */
export const THREAD_LIFE_MS = 2000;

/**
 * The thread between a wrapped span and the work it came from. Unsourced draws
 * halfway and stops at an open circle: the record showed nothing to reach.
 * It is drawn in viewport coordinates, so it retires quickly and on any scroll
 * rather than pointing confidently at the wrong thing.
 */
export function ThreadLine({
  from,
  targetId,
  sourced,
  reduceMotion,
  status = "unsourced",
  onDone,
}: {
  from: { x: number; y: number };
  targetId: string | null;
  sourced: boolean;
  reduceMotion: boolean;
  status?: SpanStatus;
  onDone?: () => void;
}) {
  const [to, setTo] = useState<{ x: number; y: number } | null>(null);
  const [fading, setFading] = useState(false);
  const motion = useMotion("provenance.tracing");

  useEffect(() => {
    const id = window.setTimeout(() => {
      const target = targetId ? document.getElementById(targetId) : null;
      const rect = target?.getBoundingClientRect();
      setTo(rect ? { x: rect.right, y: rect.top + rect.height / 2 } : null);
    }, 60);
    return () => window.clearTimeout(id);
  }, [targetId, from.x, from.y]);

  // Retire on its own, and immediately if either pane scrolls under it.
  useEffect(() => {
    const finish = () => onDone?.();
    const fade = window.setTimeout(() => {
      if (reduceMotion) finish();
      else setFading(true);
    }, THREAD_LIFE_MS);
    const after = window.setTimeout(finish, reduceMotion ? THREAD_LIFE_MS : THREAD_LIFE_MS + 220);
    window.addEventListener("scroll", finish, true);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(after);
      window.removeEventListener("scroll", finish, true);
    };
  }, [reduceMotion, onDone]);

  const end = sourced && to ? to : { x: from.x - 120, y: from.y };
  const stroke = spanStatusStroke(status);

  return (
    <svg
      data-testid="audit-thread"
      className={`pointer-events-none fixed inset-0 z-[60] h-full w-full ${
        fading ? "nb-thread-fade" : ""
      }`}
      aria-hidden
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={end.x}
        y2={end.y}
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray={sourced ? undefined : "4 4"}
        className={reduceMotion ? "" : motion.className}
      />
      {!sourced ? (
        <circle cx={end.x} cy={end.y} r={4} fill="none" stroke={stroke} strokeWidth={1.5} />
      ) : null}
    </svg>
  );
}
