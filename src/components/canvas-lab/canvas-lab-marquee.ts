import { isWorkboardDecorationKind } from "@/lib/canvas-lab-shared";

/** B3: box-select on the board. Pure, so the rules can be tested alone. */
export type MarqueePoint = { x: number; y: number };
export type MarqueeRect = { x: number; y: number; width: number; height: number };
type MarqueeNode = { id: string; kind: string; x: number; y: number; width: number; height: number };

/** The box between where the drag started and where the pointer is now. */
export function marqueeRect(from: MarqueePoint, to: MarqueePoint): MarqueeRect {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

/** Under 4px in both directions (on screen) is a click on the board, not a box. */
export const MARQUEE_CLICK_PX = 4;
export function isMarqueeClick(screenRect: MarqueeRect): boolean {
  return screenRect.width < MARQUEE_CLICK_PX && screenRect.height < MARQUEE_CLICK_PX;
}

/**
 * Ids of the cards whose rectangle touches the box, like selecting files on a
 * desktop. Decorations, answers and removed cards are never picked.
 */
export function cardsInMarquee(
  rect: MarqueeRect,
  nodes: readonly MarqueeNode[],
  measuredHeights?: ReadonlyMap<string, number>,
  hiddenIds: readonly string[] = [],
): string[] {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  return nodes
    .filter((node) => node.kind !== "answer" && !isWorkboardDecorationKind(node.kind as never) && !hiddenIds.includes(node.id))
    .filter((node) => {
      const height = measuredHeights?.get(node.id) ?? node.height;
      return node.x < right && node.x + node.width > rect.x && node.y < bottom && node.y + height > rect.y;
    })
    .map((node) => node.id);
}

/** Replace the context with the boxed cards, or add them when Shift is held. */
export function applyMarqueeSelection(current: readonly string[], ids: readonly string[], shift: boolean): string[] {
  if (!shift) return [...ids];
  return [...current, ...ids.filter((id) => !current.includes(id))];
}
