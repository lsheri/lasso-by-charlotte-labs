/**
 * Graphite marks (pass 88). Three hand-drawn strokes, and only these three.
 *
 * A mark is presentation beside a human action that already happened: the
 * CHECK when something is confirmed or accepted, the ELLIPSE when a share is
 * confirmed, the STRIKE when something is discarded. Marks never delay, block
 * or reorder a write, carry no telemetry, and are aria-hidden.
 *
 * One per viewport: a mark that starts while another started less than 400ms
 * ago renders nothing at all, statically.
 */
import { useCallback, useRef, useState } from "react";

const MARK_WINDOW_MS = 400;

let lastMarkAt = -Infinity;

/** The one-per-viewport gate. Returns false when another mark just started. */
export function claimMark(now: number = Date.now()): boolean {
  if (now - lastMarkAt < MARK_WINDOW_MS) return false;
  lastMarkAt = now;
  return true;
}

/** Test seam: forget the last claim. */
export function resetMarkGate(): void {
  lastMarkAt = -Infinity;
}

/**
 * Fire-and-forget trigger for a mark. `fire()` shows the mark; it clears
 * itself once the stroke has landed. Callers never await it.
 */
export function useMark(hold = 900): { shown: boolean; markKey: number; fire: () => void } {
  const [state, setState] = useState<{ shown: boolean; key: number }>({ shown: false, key: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fire = useCallback(() => {
    setState((prev) => ({ shown: true, key: prev.key + 1 }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState((prev) => ({ ...prev, shown: false })), hold);
  }, [hold]);

  return { shown: state.shown, markKey: state.key, fire };
}

function useClaim(): boolean {
  const [claimed] = useState(() => claimMark(Date.now()));
  return claimed;
}

/** Confirmed, accepted. Drawn beside the thing that was decided. */
export function DrawnCheck({ size = 18, className = "" }: { size?: number; className?: string }) {
  if (!useClaim()) return null;
  return (
    <svg
      className={`nb-mark pointer-events-none ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="var(--nb-graphite)"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path pathLength={1} d="M3 11.4c1.7.7 3.1 2 4.2 3.6C9.4 10.6 12.4 6.9 17 4.2" />
    </svg>
  );
}

/** Shared. Circled the thing that is now visible to someone else. */
export function DrawnEllipse({ className = "" }: { className?: string }) {
  if (!useClaim()) return null;
  return (
    <svg
      className={`nb-mark pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox="0 0 200 44"
      preserveAspectRatio="none"
      fill="none"
      stroke="var(--nb-graphite)"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      aria-hidden
    >
      <path
        pathLength={1}
        vectorEffect="non-scaling-stroke"
        d="M100 4C148 3.4 195 10 195 22.6c0 12.4-46 18.6-95 18.6C52 41.2 5 35.4 5 22.4 5 10.2 50 4.6 100 4c14-.2 28 .6 41 2.6"
      />
    </svg>
  );
}

/** Discarded. One quick pen line through the label. */
export function DrawnStrike({ className = "" }: { className?: string }) {
  if (!useClaim()) return null;
  return (
    <svg
      className={`nb-mark pointer-events-none absolute inset-x-0 top-1/2 h-3 w-full -translate-y-1/2 ${className}`}
      viewBox="0 0 120 12"
      preserveAspectRatio="none"
      fill="none"
      stroke="var(--nb-graphite)"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      aria-hidden
    >
      <path
        pathLength={1}
        vectorEffect="non-scaling-stroke"
        d="M4 7C24 5.4 44 8.2 64 6.6c18-1.4 36 .6 52-1.2"
      />
    </svg>
  );
}
