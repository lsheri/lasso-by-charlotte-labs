/**
 * The work canvas, as pure moves.
 *
 * No React, no DOM, no Supabase. The pointer path and the keyboard path both
 * resolve through here, so they provably cannot drift apart, exactly as
 * src/lib/canvas-move.ts already does for the board.
 */

export const DRAG_SLOP = 6;
export const DRAG_HOLD_MS = 300;
export const DRAG_STEP = 22; // one grid square
export const DRAG_STEP_COARSE = 110; // shift + arrow

export type Point = { x: number; y: number };

const snapOne = (value: number) => Math.max(0, Math.round(value / DRAG_STEP) * DRAG_STEP);

/** Snap to the grid and never allow a negative coordinate. */
export function snapPoint(p: Point): Point {
  return { x: snapOne(p.x), y: snapOne(p.y) };
}

/** Where a pointer drag lands: origin plus delta, snapped and clamped. */
export function dragTo(origin: Point, delta: Point): Point {
  return snapPoint({ x: origin.x + delta.x, y: origin.y + delta.y });
}

/** Where an arrow key lands. `shift` uses the coarse step. */
export function keyTo(
  from: Point,
  key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
  shift: boolean,
): Point {
  const step = shift ? DRAG_STEP_COARSE : DRAG_STEP;
  if (key === "ArrowUp") return { x: from.x, y: Math.max(0, from.y - step) };
  if (key === "ArrowDown") return { x: from.x, y: from.y + step };
  if (key === "ArrowLeft") return { x: Math.max(0, from.x - step), y: from.y };
  return { x: from.x + step, y: from.y };
}

/** True once the pointer has moved far enough to count as a drag, not a click. */
export function passedSlop(delta: Point): boolean {
  return Math.hypot(delta.x, delta.y) >= DRAG_SLOP;
}
