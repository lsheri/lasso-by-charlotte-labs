/**
 * B4: drawing a workstream on the workboard.
 *
 * The box claims the cards inside it. A card belongs to one workstream, so a
 * card that already sits in another one is never moved without asking.
 *
 * Pure geometry and sorting only. No React, no network.
 */

import { isContextFrameId } from "@/lib/context-region";

export type DrawPoint = { x: number; y: number };
export type DrawRect = { x: number; y: number; width: number; height: number };

export type ClaimCandidate = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Null on a blank board, where no outline exists to belong to. */
  frame?: string | null | undefined;
  /** Present on work cards. Cards without one never reach the placement call. */
  workItemId?: string | null | undefined;
};

export type ClaimSplit = {
  /** Work cards with no workstream of their own. Moved without asking. */
  silent: ClaimCandidate[];
  /** Work cards already in another workstream. Asked about once. */
  ask: ClaimCandidate[];
  /** Everything else inside the box. Board outline only, no placement call. */
  frameOnly: ClaimCandidate[];
};

/** Below this the drag reads as a click, not a box. */
export const DRAW_MIN_SIZE = 40;

/** The two corners of a drag, in board coordinates, as a positive rectangle. */
export function drawnRect(from: DrawPoint, to: DrawPoint): DrawRect {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  return { x, y, width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) };
}

export function drawnRectUsable(rect: DrawRect): boolean {
  return rect.width >= DRAW_MIN_SIZE && rect.height >= DRAW_MIN_SIZE;
}

/** Fully inside, never merely touched. */
export function fullyInside(rect: DrawRect, card: ClaimCandidate): boolean {
  return (
    card.x >= rect.x &&
    card.y >= rect.y &&
    card.x + card.width <= rect.x + rect.width &&
    card.y + card.height <= rect.y + rect.height
  );
}

/** A frame that stands for a workstream of its own, not a base area. */
function isWorkstreamFrame(frameId: string | null | undefined, defaultHomeFrameIds: readonly string[]): boolean {
  if (!frameId || !frameId.startsWith("task:")) return false;
  return !defaultHomeFrameIds.includes(frameId);
}

export function splitClaims(
  rect: DrawRect,
  cards: readonly ClaimCandidate[],
  options: { defaultHomeFrameIds?: readonly string[] } = {},
): ClaimSplit {
  const homes = options.defaultHomeFrameIds ?? [];
  const split: ClaimSplit = { silent: [], ask: [], frameOnly: [] };
  for (const card of cards) {
    if (!fullyInside(rect, card)) continue;
    // The context region is not a workstream, so a box drawn over it never
    // claims the brief or the documents that came in with it.
    if (isContextFrameId(card.frame)) continue;
    if (!card.workItemId) {
      split.frameOnly.push(card);
      continue;
    }
    if (isWorkstreamFrame(card.frame, homes)) split.ask.push(card);
    else split.silent.push(card);
  }
  return split;
}

/** A name the person can overwrite straight away. */
export function defaultWorkstreamName(existing: readonly string[]): string {
  const taken = new Set(existing.map((name) => name.trim().toLowerCase()));
  for (let index = 1; index < 200; index += 1) {
    const candidate = index === 1 ? "New workstream" : `New workstream ${index}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return "New workstream";
}

export function movePromptText(count: number): string {
  return count === 1
    ? "Move 1 card into this workstream?"
    : `Move ${count} cards into this workstream?`;
}
