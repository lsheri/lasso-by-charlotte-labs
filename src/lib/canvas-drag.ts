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

const snapOne = (value: number) => Math.round(value / DRAG_STEP) * DRAG_STEP;

/** Snap to the grid in either direction from the board origin. */
export function snapPoint(p: Point): Point {
  return { x: snapOne(p.x), y: snapOne(p.y) };
}

/** Where a pointer drag lands: origin plus delta, snapped. */
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
  if (key === "ArrowUp") return { x: from.x, y: from.y - step };
  if (key === "ArrowDown") return { x: from.x, y: from.y + step };
  if (key === "ArrowLeft") return { x: from.x - step, y: from.y };
  return { x: from.x + step, y: from.y };
}

/** True once the pointer has moved far enough to count as a drag, not a click. */
export function passedSlop(delta: Point): boolean {
  return Math.hypot(delta.x, delta.y) >= DRAG_SLOP;
}

/**
 * A click that moved a little is still a click. Straight-line screen pixels,
 * never zoom-scaled: an unsteady hand or a trackpad's sub-pixel noise must
 * still open the card. Tunable here only.
 */
export const CLICK_SUPPRESS_PX = 4;

/** True once a press-to-release moved far enough that the click is a drag's tail. */
export function movedBeyondClick(start: Point, end: Point): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) > CLICK_SUPPRESS_PX;
}

/**
 * The one-gesture suppression flag shared by the pointer path and the click
 * capture handler. It is cleared on press and on release, never on a timer,
 * so it cannot outlive the gesture that set it.
 */
export type ClickSuppress = { current: boolean };

export function beginClickGesture(suppress: ClickSuppress): void {
  suppress.current = false;
}

export function endClickGesture(suppress: ClickSuppress, start: Point, end: Point): void {
  suppress.current = movedBeyondClick(start, end);
}

export function cancelClickGesture(suppress: ClickSuppress): void {
  suppress.current = false;
}

/** Returns true when the click is a drag's tail and must be swallowed, once. */
export function swallowClickIfDrag(suppress: ClickSuppress): boolean {
  if (!suppress.current) return false;
  suppress.current = false;
  return true;
}
