/**
 * B3: the reasoning trail as something a person adds to a blank board.
 *
 * The trail is the existing guide panel, placed on the board as one ordinary
 * outline row so that its position is durable and it can be moved and removed.
 * It is never a workstream and never the context region.
 *
 * Pure geometry only. No React, no network.
 */

import { snapPoint, type Point } from "@/lib/canvas-drag";

export const TRAIL_FRAME_ID = "trail";
export const TRAIL_FRAME_LABEL = "Reasoning trail";

/** The panel's own footprint, matching the guide panel it draws. */
export const TRAIL_SIZE = { width: 720, height: 150 } as const;

export type TrailRect = { x: number; y: number; width: number; height: number };

export function isTrailFrameId(id: string | null | undefined): boolean {
  return id === TRAIL_FRAME_ID;
}

/** One trail per board, so the control is offered only while there is none. */
export function boardHasTrail(frames: readonly { id: string }[]): boolean {
  return frames.some((frame) => isTrailFrameId(frame.id));
}

/** The trail lands where the person asked for it, on the grid. */
export function trailRectAt(anchor: Point): TrailRect {
  const at = snapPoint(anchor);
  return { x: at.x, y: at.y, width: TRAIL_SIZE.width, height: TRAIL_SIZE.height };
}
