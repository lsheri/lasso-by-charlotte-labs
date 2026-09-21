/**
 * B2: the context area on a blank board.
 *
 * The brief and the documents that came in with it live in one region of
 * their own. The region is an ordinary board outline, so it moves and resizes
 * like any other, but it is not a workstream and nothing here ever treats it
 * as one.
 *
 * Pure geometry only. No React, no network.
 */

import { snapPoint, type Point } from "@/lib/canvas-drag";
import { isTrailFrameId } from "@/lib/reasoning-trail";
import { PLACEMENT_CARD, PLACEMENT_GAP, slotIsFree, type PlacementRect } from "@/lib/workboard-placement";

export const CONTEXT_FRAME_ID = "context";
export const CONTEXT_FRAME_LABEL = "Context";

/** Room for the region's own name above its first row of cards. */
export const CONTEXT_HEADER = 32;
export const CONTEXT_PADDING = 24;
export const CONTEXT_COLUMNS = 2;

const MIN_WIDTH = 260;
const MIN_HEIGHT = 220;

export type ContextRect = { x: number; y: number; width: number; height: number };

export function isContextFrameId(id: string | null | undefined): boolean {
  return id === CONTEXT_FRAME_ID;
}

/**
 * A frame that stands for a workstream. The context region never does, so
 * every workstream surface can ask this one question.
 */
export function isWorkstreamFrameId(id: string | null | undefined): boolean {
  if (!id || isContextFrameId(id) || isTrailFrameId(id)) return false;
  return id.startsWith("task:") || id.startsWith("custom:") || id === "workstreams";
}

/** The region is created lazily: no brief and no documents means no region. */
export function needsContextRegion(input: { hasBrief: boolean; fileCount: number }): boolean {
  return input.hasBrief || input.fileCount > 0;
}

function stepX(): number {
  return PLACEMENT_CARD.width + PLACEMENT_GAP;
}

function stepY(): number {
  return PLACEMENT_CARD.height + PLACEMENT_GAP;
}

/** A region big enough for the cards it is about to hold. */
export function contextRegionRect(anchor: Point, count: number): ContextRect {
  const rows = Math.max(1, Math.ceil(Math.max(count, 1) / CONTEXT_COLUMNS));
  const at = snapPoint(anchor);
  const width = Math.max(
    MIN_WIDTH,
    CONTEXT_PADDING * 2 + CONTEXT_COLUMNS * PLACEMENT_CARD.width + (CONTEXT_COLUMNS - 1) * PLACEMENT_GAP,
  );
  const height = Math.max(
    MIN_HEIGHT,
    CONTEXT_HEADER + CONTEXT_PADDING * 2 + rows * PLACEMENT_CARD.height + (rows - 1) * PLACEMENT_GAP,
  );
  return { x: at.x, y: at.y, width, height };
}

/**
 * The region that wraps a card already on the board, so placing the brief in
 * context never moves the brief itself.
 */
export function contextRegionAround(card: { x: number; y: number }, count: number): ContextRect {
  return contextRegionRect({ x: card.x - CONTEXT_PADDING, y: card.y - CONTEXT_HEADER - CONTEXT_PADDING }, count);
}

/** Free places inside the region, row by row, avoiding whatever is already there. */
export function contextSlots(rect: ContextRect, taken: PlacementRect[], count: number): Point[] {
  const occupied = [...taken];
  const points: Point[] = [];
  const rows = 60;
  for (let row = 0; row < rows && points.length < count; row += 1) {
    for (let column = 0; column < CONTEXT_COLUMNS && points.length < count; column += 1) {
      const point = snapPoint({
        x: rect.x + CONTEXT_PADDING + column * stepX(),
        y: rect.y + CONTEXT_HEADER + CONTEXT_PADDING + row * stepY(),
      });
      if (!slotIsFree({ ...point, ...PLACEMENT_CARD }, occupied, PLACEMENT_GAP)) continue;
      points.push(point);
      occupied.push({ ...point, ...PLACEMENT_CARD });
    }
  }
  return points;
}

/**
 * A card that is sitting in the region's rectangle without belonging to it.
 * The packed flow on a blank board starts at the origin, so an unrelated card
 * can land under the region and read as context when it is not.
 */
export function overlapsContextRegion(rect: ContextRect, card: PlacementRect): boolean {
  return card.x < rect.x + rect.width && card.x + card.width > rect.x && card.y < rect.y + rect.height && card.y + card.height > rect.y;
}

/** The region grows downwards to keep every one of its cards inside it. */
export function contextRegionFor(rect: ContextRect, cards: PlacementRect[]): ContextRect {
  if (cards.length === 0) return rect;
  const bottom = Math.max(...cards.map((card) => card.y + card.height)) + CONTEXT_PADDING;
  const right = Math.max(...cards.map((card) => card.x + card.width)) + CONTEXT_PADDING;
  return {
    ...rect,
    width: Math.max(rect.width, right - rect.x),
    height: Math.max(rect.height, bottom - rect.y),
  };
}

/**
 * Where a card lands when it is taken out of context: on the board, below the
 * region. The search only walks down and across to the right, so the card is
 * never pushed back up inside the region it just left.
 */
export function contextExitPoint(rect: ContextRect, taken: PlacementRect[]): Point {
  const base = snapPoint({ x: rect.x, y: rect.y + rect.height + PLACEMENT_GAP });
  for (let row = 0; row < 40; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      const point = snapPoint({ x: base.x + column * stepX(), y: base.y + row * stepY() });
      if (slotIsFree({ ...point, ...PLACEMENT_CARD }, taken, PLACEMENT_GAP)) return point;
    }
  }
  return base;
}
