import type { CSSProperties } from "react";

/**
 * "Looking through the conversations." A few notes light up briefly and fade,
 * at staggered intervals, never all at once, so the page reads as reading
 * rather than as a progress bar.
 *
 * The page applies `shimmerStyle(index)` together with the `nb-chat-shimmer`
 * class to its real notes; this component draws the same thing on blank paper
 * so the scene can be reviewed on its own.
 */

const CYCLE_MS = 2600;

/** Staggered delay and duration for one note, stable for a given index. */
export function shimmerStyle(index: number): CSSProperties {
  // A prime-ish step keeps neighbours out of step with each other, so the
  // lighting never sweeps the grid in rows.
  const delay = ((index * 370) % CYCLE_MS) / 1000;
  const duration = (CYCLE_MS + (index % 4) * 240) / 1000;
  return {
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
  } as CSSProperties;
}

export function ChatShimmer({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden className="flex flex-wrap justify-center gap-2">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="nb-chat-shimmer block h-[54px] w-[74px] rounded-[6px] border border-pencil bg-card"
          style={shimmerStyle(index)}
        />
      ))}
    </div>
  );
}
