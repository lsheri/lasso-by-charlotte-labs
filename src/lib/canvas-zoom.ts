/**
 * The work canvas, as pure zoom.
 *
 * No React, no DOM, no Supabase, exactly like src/lib/canvas-drag.ts beside
 * it. The buttons, the keyboard and the pinch gesture all resolve through
 * here, so they cannot drift apart.
 */

export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 1.6;
export const ZOOM_STEP = 0.1;
export const ZOOM_DEFAULT = 1;

/** Hold the range at both ends. */
export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/** One step in or out, clamped. */
export function stepZoom(z: number, direction: "in" | "out"): number {
  return clampZoom(z + (direction === "in" ? ZOOM_STEP : -ZOOM_STEP));
}

/**
 * A wheel delta turned into a new zoom. A trackpad pinch arrives as a wheel
 * event with `ctrlKey` true, so this is the same path as a ctrl or cmd wheel.
 * Scaling by the delta's magnitude, never a fixed factor per event, so one
 * flick does not slam straight to the limit.
 */
export function pinchZoom(z: number, deltaY: number): number {
  return clampZoom(z * Math.exp(-deltaY * 0.0015));
}
