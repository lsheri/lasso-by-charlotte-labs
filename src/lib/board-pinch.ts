/**
 * Two-finger pinch on the Workboard, as pure maths.
 *
 * No React, no DOM. Points are screen pixels measured from the board
 * surface's top-left, the same space `zoomAbout` in canvas-zoom.ts uses.
 */
import { clampZoom, type ZoomPoint } from "@/lib/canvas-zoom";

export type PinchView = { pan: ZoomPoint; zoom: number };
export type PinchStart = PinchView & { mid: ZoomPoint; distance: number };

export function pinchMidpoint(a: ZoomPoint, b: ZoomPoint): ZoomPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function pinchDistance(a: ZoomPoint, b: ZoomPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Snapshot the view and the two fingers at the moment the second one lands. */
export function beginPinch(view: PinchView, a: ZoomPoint, b: ZoomPoint): PinchStart {
  return { pan: { ...view.pan }, zoom: view.zoom, mid: pinchMidpoint(a, b), distance: pinchDistance(a, b) };
}

/**
 * The view for the fingers' current positions. Zoom scales by the distance
 * ratio, clamped to the board's limits; the board point that sat under the
 * starting midpoint follows the current midpoint, so two fingers also pan.
 */
export function pinchView(start: PinchStart, a: ZoomPoint, b: ZoomPoint): PinchView {
  const mid = pinchMidpoint(a, b);
  const distance = pinchDistance(a, b);
  const ratio = start.distance > 0 && distance > 0 ? distance / start.distance : 1;
  const from = Number.isFinite(start.zoom) && start.zoom > 0 ? start.zoom : 1;
  const zoom = clampZoom(from * ratio);
  const world = { x: (start.mid.x - start.pan.x) / from, y: (start.mid.y - start.pan.y) / from };
  return { zoom, pan: { x: mid.x - world.x * zoom, y: mid.y - world.y * zoom } };
}

/** One finger dragging the board: origin plus how far the finger moved. */
export function panView(origin: ZoomPoint, from: ZoomPoint, to: ZoomPoint): ZoomPoint {
  return { x: origin.x + to.x - from.x, y: origin.y + to.y - from.y };
}
