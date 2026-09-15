/**
 * Drawing a connection on the canvas, as pure geometry and rules.
 *
 * No React, no DOM, no Supabase, exactly like src/lib/canvas-drag.ts. The
 * pointer path and the keyboard path both resolve through here, so they
 * provably cannot disagree about what may be linked to what.
 */

export type Point = { x: number; y: number };

export type Rect = { x: number; y: number; w: number; h: number };

export type LinkCandidate = Rect & { id: string };

export type ExistingLink = {
  from_item_id: string;
  to_item_id: string;
  relation: string;
  status: string;
};

/** The radius of a handle dot. Decoration until it is pressed. */
export const LINK_HANDLE_R = 5;

/** How close the cursor must come to a node before the guide snaps to it. */
export const LINK_SNAP = 28;

/** The four edge midpoints: top, right, bottom, left, in that order. */
export function handlePoints(node: Rect): Point[] {
  return [
    { x: node.x + node.w / 2, y: node.y },
    { x: node.x + node.w, y: node.y + node.h / 2 },
    { x: node.x + node.w / 2, y: node.y + node.h },
    { x: node.x, y: node.y + node.h / 2 },
  ];
}

/** Distance from a point to the nearest edge of a rectangle. Zero when inside. */
function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.w));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}

/**
 * The candidate under the cursor, or the closest one within LINK_SNAP.
 * Null when the cursor is over empty paper.
 */
export function nearestTarget<T extends LinkCandidate>(point: Point, candidates: T[]): T | null {
  let best: T | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = distanceToRect(point, candidate);
    if (distance > LINK_SNAP) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/**
 * Why this pair may not be drawn, or null when it may be.
 *
 * A pair whose only row is discarded can be drawn again: taking a connection
 * back and then changing your mind is a real sequence and the record keeps
 * every step of it.
 */
export function canLink(
  fromId: string,
  toId: string,
  existing: ExistingLink[],
  relation = "informed",
): string | null {
  if (!fromId || !toId || fromId === toId) return "A piece of work cannot lead to itself.";
  const already = existing.find(
    (row) =>
      row.from_item_id === fromId &&
      row.to_item_id === toId &&
      row.relation === relation &&
      row.status !== "discarded",
  );
  if (already) return "These two are already connected.";
  return null;
}
