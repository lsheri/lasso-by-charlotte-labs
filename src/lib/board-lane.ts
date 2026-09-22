/**
 * P1: a lane.
 *
 * A lane is furniture. It is a frame that owns the layout of what is inside
 * it: contents flow in the order given, top to bottom, and the lane clips and
 * scrolls what does not fit inside its own rectangle.
 *
 * A lane computes its contents' positions on every render and persists none
 * of them. Geometry stays the language the rest of the board speaks, so the
 * renderer, hit-testing and the viewport fit all keep working unchanged; the
 * difference is only that a lane's contents are positioned by their index
 * rather than by a person.
 *
 * A lane is never paint and never a workstream. It claims nothing, it maps to
 * no task, it is never @-mentionable, and it never appears where workstreams
 * appear. Its own id prefix is what keeps every region and workstream surface
 * from ever finding it.
 *
 * Pure logic only. No React, no network, no writes.
 */

/** A lane keeps its own id prefix, the way a region keeps `region:`. */
export const LANE_FRAME_PREFIX = "lane:";

export function isLaneFrameId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(LANE_FRAME_PREFIX);
}

export function newLaneFrameId(key: string): string {
  return `${LANE_FRAME_PREFIX}${key}`;
}

/** Breathing room inside a lane's rectangle, and between its contents. */
export const LANE_PADDING = 12;
export const LANE_CONTENT_GAP = 12;

export type LaneRect = { x: number; y: number; width: number; height: number };

export type LaneContent = { id: string; height: number };

/**
 * One content's computed place inside a lane, in lane-local coordinates: the
 * lane's own scrolling box is the origin. Nothing here is ever written.
 */
export type LaneContentPlacement = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
};

/** The usable width inside a lane, once its padding is taken. */
export function laneContentWidth(rect: Pick<LaneRect, "width">): number {
  return Math.max(0, rect.width - LANE_PADDING * 2);
}

/**
 * Where a lane's contents sit. Derived from the index and the lane's rect,
 * every render, and stored nowhere.
 */
export function laneContentLayout(
  rect: Pick<LaneRect, "width">,
  contents: readonly LaneContent[],
): LaneContentPlacement[] {
  const width = laneContentWidth(rect);
  const placements: LaneContentPlacement[] = [];
  let y = LANE_PADDING;
  contents.forEach((content, index) => {
    const height = Math.max(0, content.height);
    placements.push({ id: content.id, x: LANE_PADDING, y, width, height, index });
    y += height + LANE_CONTENT_GAP;
  });
  return placements;
}

/** How tall the contents run, including the closing padding. */
export function laneContentExtent(contents: readonly LaneContent[]): number {
  if (contents.length === 0) return LANE_PADDING * 2;
  const total = contents.reduce((sum, content) => sum + Math.max(0, content.height), 0);
  return LANE_PADDING * 2 + total + LANE_CONTENT_GAP * (contents.length - 1);
}

/** True when the contents run past the lane's own height, so the lane scrolls. */
export function laneOverflows(rect: Pick<LaneRect, "height">, contents: readonly LaneContent[]): boolean {
  return laneContentExtent(contents) > rect.height;
}

/**
 * Which placements are wholly or partly visible at a given scroll position.
 * Everything else is clipped by the lane, never spilled onto the board.
 */
export function laneVisiblePlacements(
  rect: Pick<LaneRect, "height">,
  placements: readonly LaneContentPlacement[],
  scrollTop = 0,
): LaneContentPlacement[] {
  const top = scrollTop;
  const bottom = scrollTop + rect.height;
  return placements.filter((placement) => placement.y < bottom && placement.y + placement.height > top);
}
