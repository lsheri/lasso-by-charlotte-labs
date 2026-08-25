/**
 * Pass 116: the completion contract. When a process finishes, the card it was
 * working on is scribbled out in graphite and then leaves the screen. The end
 * state of the scribble exists only between play() and the host's unmount, so
 * the consumer MUST unmount or exit the card in onDone.
 */
import { createElement, useCallback, useRef, useState, type ReactNode, type RefObject } from "react";

import { PencilScribble } from "@/components/notebook/marks";

export const SCRIBBLE_DRAW_MS = 420;
export const SCRIBBLE_DOTS_MS = 200;
export const SCRIBBLE_HOLD_MS = 360;

export type ScribbleState = "idle" | "playing" | "done";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function useScribbleComplete({
  targetRef,
  seed,
  holdMs = SCRIBBLE_HOLD_MS,
  onDone,
}: {
  targetRef: RefObject<HTMLElement | null>;
  seed: string;
  holdMs?: number;
  onDone?: (() => void) | undefined;
}): { play: () => void; reset: () => void; overlay: ReactNode; state: ScribbleState } {
  const [state, setState] = useState<ScribbleState>("idle");
  const [box, setBox] = useState<{ width: number; height: number }>({ width: 200, height: 20 });
  const [reduced, setReduced] = useState(false);
  const firedRef = useRef(false);
  const playedRef = useRef(false);
  const fallbackRef = useRef<number | null>(null);
  const holdRef = useRef<number | null>(null);

  const finish = useCallback(() => {
    // A reset in flight means the process failed: nothing may complete.
    if (firedRef.current || !playedRef.current) return;
    firedRef.current = true;
    holdRef.current = window.setTimeout(() => {
      holdRef.current = null;
      setState("done");
      onDone?.();
    }, holdMs);
  }, [holdMs, onDone]);

  const play = useCallback(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    const rect = targetRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) setBox({ width: rect.width, height: Math.max(rect.height, 12) });
    const still = prefersReducedMotion();
    setReduced(still);
    setState("playing");
    if (still) {
      queueMicrotask(finish);
      return;
    }
    // jsdom fires no animationend: the fallback is the guarantee, the guard
    // keeps onDone at exactly once either way.
    fallbackRef.current = window.setTimeout(() => {
      fallbackRef.current = null;
      finish();
    }, SCRIBBLE_DRAW_MS + SCRIBBLE_DOTS_MS + 100);
  }, [finish, targetRef]);

  const reset = useCallback(() => {
    if (fallbackRef.current !== null) window.clearTimeout(fallbackRef.current);
    if (holdRef.current !== null) window.clearTimeout(holdRef.current);
    fallbackRef.current = null;
    holdRef.current = null;
    playedRef.current = false;
    firedRef.current = false;
    setState("idle");
  }, []);

  const overlay =
    state === "idle"
      ? null
      : createElement(PencilScribble, {
          width: box.width,
          height: box.height,
          seed,
          skipped: reduced,
          onDone: finish,
        });

  return { play, reset, overlay, state };
}
