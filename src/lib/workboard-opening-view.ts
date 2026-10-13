import type { LabFitResult, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { ENGAGEMENT_NARROW_WIDTH } from "@/lib/engagement-default-view";

/** Automatic phone openings preserve text size; manual Fit keeps the whole-board view. */
export function workboardOpeningView(viewportWidth: number, fitted: LabFitResult, nodes: readonly Pick<LabNode, "x" | "y">[]): LabFitResult {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0 || viewportWidth >= ENGAGEMENT_NARROW_WIDTH) return fitted;
  const first = nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y)).sort((a, b) => a.y - b.y || a.x - b.x)[0];
  return { ...fitted, zoom: 1, pan: { x: 32 - (first?.x ?? fitted.bounds.x), y: 32 - (first?.y ?? fitted.bounds.y) } };
}