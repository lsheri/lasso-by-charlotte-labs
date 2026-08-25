/**
 * Pass 115: the handoff scroll. When the last node of the spine finishes
 * arriving, the overlay carries the reader down to the sections once, gently,
 * and never against their will: any scroll intent from the reader, at any
 * moment after the overlay opens, cancels the handoff for good.
 *
 * Pure presentation. No data, no telemetry, no timers standing in for the
 * animation itself: the trigger is the card's own animationend.
 */

import { useCallback, useEffect, useRef } from "react";

export const HANDOFF_DURATION_MS = 550;
export const HANDOFF_AFTER_ARRIVAL_MS = 800;
export const HANDOFF_AFTER_SKIP_MS = 300;
export const HANDOFF_TOP_GAP = 24;

/** The keys that mean "I am reading at my own pace". */
export const SCROLL_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  " ",
  "Spacebar",
  "PageUp",
  "PageDown",
  "Home",
  "End",
];

/** cubic-bezier(0.22, 1, 0.36, 1), solved for y at a given x. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const curve = (t: number, a: number, b: number) =>
    3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  return (x: number): number => {
    let low = 0;
    let high = 1;
    let t = x;
    for (let i = 0; i < 24; i += 1) {
      const at = curve(t, x1, x2);
      if (Math.abs(at - x) < 0.0005) break;
      if (at < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return curve(t, y1, y2);
  };
}

const EASE = cubicBezier(0.22, 1, 0.36, 1);

export type HandoffScroll = {
  containerRef: { current: HTMLElement | null };
  targetRef: { current: HTMLElement | null };
  /** True once the reader moved the page themselves. Named by the spec. */
  userHasScrolled: { current: boolean };
  /** Mark the reader as in control, cancelling any handoff in flight. */
  markUserScrolled: () => void;
  /** Run the handoff after a delay, at most once for the life of the overlay. */
  requestHandoff: (delayMs: number) => void;
};

export function useHandoffScroll(options: {
  reducedMotion: boolean;
  /** While the reveal is still drawing, a click or key press is a skip, not a scroll. */
  skippableRef?: { current: boolean };
}): HandoffScroll {
  const { reducedMotion } = options;
  const containerRef = useRef<HTMLElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const userHasScrolled = useRef(false);
  const fired = useRef(false);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markUserScrolled = useCallback(() => {
    userHasScrolled.current = true;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const skippable = options.skippableRef;
    const onWheel = () => markUserScrolled();
    const onTouch = () => markUserScrolled();
    const onPointer = () => {
      // The skip click is the reader completing the reveal, not scrolling.
      if (skippable?.current) return;
      markUserScrolled();
    };
    const onKey = (event: KeyboardEvent) => {
      if (!SCROLL_KEYS.includes(event.key)) return;
      if (skippable?.current) return;
      markUserScrolled();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [markUserScrolled, options.skippableRef]);

  const run = useCallback(() => {
    if (reducedMotion || userHasScrolled.current) return;
    const container = containerRef.current;
    const target = targetRef.current;
    if (!container || !target) return;
    const from = container.scrollTop;
    const to = Math.max(0, target.offsetTop - container.offsetTop - HANDOFF_TOP_GAP);
    if (Math.abs(to - from) < 1) return;
    const started = performance.now();
    const step = () => {
      if (userHasScrolled.current) {
        frame.current = null;
        return;
      }
      const t = Math.min(1, (performance.now() - started) / HANDOFF_DURATION_MS);
      container.scrollTop = from + (to - from) * EASE(t);
      if (t < 1) frame.current = requestAnimationFrame(step);
      else frame.current = null;
    };
    frame.current = requestAnimationFrame(step);
  }, [reducedMotion]);

  const requestHandoff = useCallback(
    (delayMs: number) => {
      if (reducedMotion || fired.current || userHasScrolled.current) return;
      fired.current = true;
      timer.current = setTimeout(run, delayMs);
    },
    [reducedMotion, run],
  );

  return { containerRef, targetRef, userHasScrolled, markUserScrolled, requestHandoff };
}
