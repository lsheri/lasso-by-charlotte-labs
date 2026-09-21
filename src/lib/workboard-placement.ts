/**
 * Where work added from the board lands.
 *
 * Pure geometry: no React, no DOM, no database. A card never lands on top of
 * another card or a workstream outline. Everything is measured from the point
 * the person chose, and the board is unbounded, so negative coordinates are
 * ordinary.
 */

import { DRAG_STEP, snapPoint, type Point } from "@/lib/canvas-drag";
import { WORKBOARD_CARD_DEFAULT_SIZE, isWorkboardDecorationKind } from "@/lib/canvas-lab-shared";

export type PlacementRect = { x: number; y: number; width: number; height: number };
export type PlacementNode = PlacementRect & { kind?: string };

/** Decoration never pushes newly placed work away from the chosen point. */
export function placementRectsForNodes(nodes: PlacementNode[]): PlacementRect[] {
  return nodes
    .filter((node) => !node.kind || !isWorkboardDecorationKind(node.kind))
    .map(({ x, y, width, height }) => ({ x, y, width, height }));
}

/** The clear space kept around every existing card and outline. */
export const PLACEMENT_GAP = 24;

export const PLACEMENT_CARD = {
  width: WORKBOARD_CARD_DEFAULT_SIZE.width,
  height: WORKBOARD_CARD_DEFAULT_SIZE.height,
};

/** One grid-aligned step, big enough to hold the gap on either side. */
function gridStep(span: number, gap: number): number {
  return Math.ceil((span + gap) / DRAG_STEP) * DRAG_STEP;
}

function clashes(candidate: PlacementRect, taken: PlacementRect, gap: number): boolean {
  return (
    candidate.x < taken.x + taken.width + gap &&
    candidate.x + candidate.width + gap > taken.x &&
    candidate.y < taken.y + taken.height + gap &&
    candidate.y + candidate.height + gap > taken.y
  );
}

export function slotIsFree(candidate: PlacementRect, taken: PlacementRect[], gap = PLACEMENT_GAP): boolean {
  return taken.every((rect) => !clashes(candidate, rect, gap));
}

/** Rings outwards from the middle, nearest first, right and down preferred. */
function ringOffsets(ring: number): Point[] {
  if (ring === 0) return [{ x: 0, y: 0 }];
  const offsets: Point[] = [];
  for (let dy = -ring; dy <= ring; dy += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      offsets.push({ x: dx, y: dy });
    }
  }
  return offsets.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.y - b.y || a.x - b.x);
}

/**
 * The nearest free slot to `anchor`, keeping the gap from everything already
 * on the board. Slots sit on the same grid the board drags on.
 */
export function nearestFreeSlot(
  anchor: Point,
  taken: PlacementRect[],
  size = PLACEMENT_CARD,
  gap = PLACEMENT_GAP,
): Point {
  const base = snapPoint(anchor);
  const stepX = gridStep(size.width, gap);
  const stepY = gridStep(size.height, gap);
  for (let ring = 0; ring <= 40; ring += 1) {
    for (const offset of ringOffsets(ring)) {
      const point = { x: base.x + offset.x * stepX, y: base.y + offset.y * stepY };
      if (slotIsFree({ ...point, ...size }, taken, gap)) return point;
    }
  }
  return base;
}

/**
 * Several items laid out in a compact grid from the chosen point. Each one
 * obeys the same gap, including against the ones placed just before it.
 */
export function placeAddedCards(
  anchor: Point,
  taken: PlacementRect[],
  count: number,
  options?: { size?: { width: number; height: number }; gap?: number; columns?: number },
): Point[] {
  const size = options?.size ?? PLACEMENT_CARD;
  const gap = options?.gap ?? PLACEMENT_GAP;
  const columns = Math.max(1, options?.columns ?? 3);
  const stepX = gridStep(size.width, gap);
  const stepY = gridStep(size.height, gap);
  const base = snapPoint(anchor);
  const occupied = [...taken];
  const points: Point[] = [];
  for (let index = 0; index < Math.max(0, count); index += 1) {
    const wanted = {
      x: base.x + (index % columns) * stepX,
      y: base.y + Math.floor(index / columns) * stepY,
    };
    const point = nearestFreeSlot(wanted, occupied, size, gap);
    points.push(point);
    occupied.push({ ...point, ...size });
  }
  return points;
}
