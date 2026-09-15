import type { ReactNode } from "react";

import { resolveMotion } from "@/lib/motion-registry";
import { useReducedMotion } from "@/hooks/use-motion";

/**
 * PASS D — the circle.
 *
 * An open hand-drawn loop around something that has a new note on it. It is
 * never a badge and never a dot: it is the mark a person would make with a
 * pencil around the thing they want you to look at.
 *
 * Presentational only. It decides nothing about who may see it; the caller
 * does. A coach is never handed one.
 */
export function CircleMark({
  children,
  label,
  className = "",
}: {
  children: ReactNode;
  /** Read out to assistive tech, since the loop itself carries no words. */
  label?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const motion = resolveMotion("coachnote.arrived", reduce);

  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      <svg
        className={`nb-circle-mark ${motion.className}`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
        focusable="false"

        data-testid="circle-mark"
        role="presentation"
      >
        <path
          pathLength={1}
          d="M6 52C4 26 28 7 54 6C80 5 96 24 95 49C94 73 72 94 47 94C24 94 7 79 6 57C5 40 17 25 38 18"
          stroke="var(--nb-green)"
          strokeOpacity={0.7}
          strokeWidth="var(--nb-circle-stroke, 1.4)"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
