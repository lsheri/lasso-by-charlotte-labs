/**
 * PASS 133 — the reading scroll, as pure motion.
 *
 * The working read-through moves at a person's pace, not the document's. A
 * six turn chat and a sixty turn chat travel at exactly the same speed; only
 * the time it takes to reach the bottom differs. Reaching an end is a soft
 * turn, not a bounce, and then the read comes back the other way, forever,
 * because the wait is indeterminate and the motion should never pretend
 * otherwise.
 */

/** Pixels per second. A calm skim, the same for every conversation. */
export const READ_SPEED_PX_S = 55;

/** How long the turn at each end takes to decelerate and pick back up. */
export const TURN_EASE_MS = 400;

/**
 * The band near each end where speed eases. Derived from the speed and the
 * turn duration so the two constants stay in agreement.
 */
export const TURN_EASE_PX = (READ_SPEED_PX_S * TURN_EASE_MS) / 1000 / 2;

/** Speed never reaches zero, or the read would stall at the edges. */
const MIN_FACTOR = 0.15;

export type ScrollState = {
  /** Current scrollTop, in pixels. */
  pos: number;
  /** 1 reads down the page, -1 reads back up. */
  dir: 1 | -1;
};

function ease(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return MIN_FACTOR + (1 - MIN_FACTOR) * (clamped * (2 - clamped));
}

/**
 * One frame of the read. Delta driven, so the speed is the same on a 60Hz
 * laptop and a 120Hz phone.
 */
export function advanceScroll(
  state: ScrollState,
  maxScroll: number,
  dtMs: number,
): ScrollState {
  const limit = Math.max(maxScroll, 0);
  if (limit <= 0) return { pos: 0, dir: state.dir };

  const pos = Math.max(0, Math.min(state.pos, limit));
  const ahead = state.dir === 1 ? limit - pos : pos;
  const factor = ease(ahead / TURN_EASE_PX);
  const travelled = (READ_SPEED_PX_S * dtMs) / 1000 * factor;
  let next = pos + travelled * state.dir;
  let dir = state.dir;

  if (next >= limit) {
    next = limit;
    dir = -1;
  } else if (next <= 0) {
    next = 0;
    dir = 1;
  }
  return { pos: next, dir };
}
