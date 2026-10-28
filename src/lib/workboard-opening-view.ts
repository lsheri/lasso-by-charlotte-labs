import type { LabFitResult, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { ENGAGEMENT_NARROW_WIDTH } from "@/lib/engagement-default-view";

/** Fit may go to the board minimum, but opening a board holds at a readable zoom. */
export const OPENING_ZOOM_MIN = 0.4;

/** Automatic phone openings preserve text size; manual Fit keeps the whole-board view. */
export function workboardOpeningView(viewportWidth: number, fitted: LabFitResult, nodes: readonly Pick<LabNode, "x" | "y">[]): LabFitResult {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0 || viewportWidth >= ENGAGEMENT_NARROW_WIDTH) {
    if (!(fitted.zoom < OPENING_ZOOM_MIN)) return { ...fitted, pan: { ...fitted.pan, y: Math.max(fitted.pan.y, 86 - fitted.bounds.y * fitted.zoom) } };
    return { ...fitted, zoom: OPENING_ZOOM_MIN, pan: { x: 32 - fitted.bounds.x * OPENING_ZOOM_MIN, y: 86 - fitted.bounds.y * OPENING_ZOOM_MIN } };
  }
  const first = nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y)).sort((a, b) => a.y - b.y || a.x - b.x)[0];
  return { ...fitted, zoom: 1, pan: { x: 32 - (first?.x ?? fitted.bounds.x), y: 86 - (first?.y ?? fitted.bounds.y) } };
}