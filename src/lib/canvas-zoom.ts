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

/**
 * The Workboard's own pinch response. A trackpad pinch reports a handful of
 * pixels per event, a mouse wheel notch reports about a hundred, so the two
 * need different sensitivity to feel the same under the hand. The per-event
 * factor is held inside a narrow band so no single event jumps the view.
 */
export function workboardPinchZoom(z: number, deltaY: number, deltaMode = 0): number {
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1;
  const pixels = deltaY * unit;
  const sensitivity = deltaMode === 0 && Math.abs(pixels) < 40 ? 0.01 : 0.002;
  const factor = Math.min(1.18, Math.max(0.85, Math.exp(-pixels * sensitivity)));
  return clampZoom((Number.isFinite(z) && z > 0 ? z : ZOOM_DEFAULT) * factor);
}

export type ZoomPoint = { x: number; y: number };

/**
 * Keep one world point under the cursor while the zoom changes.
 * `point` is measured from the viewport's top-left, in screen pixels.
 */
export function zoomAbout(pan: ZoomPoint, zoom: number, nextZoom: number, point: ZoomPoint): ZoomPoint {
  const from = Number.isFinite(zoom) && zoom > 0 ? zoom : ZOOM_DEFAULT;
  const to = clampZoom(nextZoom);
  const ratio = to / from;
  return { x: point.x - (point.x - pan.x) * ratio, y: point.y - (point.y - pan.y) * ratio };
}

/** A wheel event turned into pixels, whatever unit the browser reported. */
export function wheelPanDelta(event: { deltaX: number; deltaY: number; deltaMode?: number }): ZoomPoint {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
  return { x: event.deltaX * unit, y: event.deltaY * unit };
}
