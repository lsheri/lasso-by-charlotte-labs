/**
 * SEC-1: a section.
 *
 * A section is furniture. Its titled outline marks an area that may contain
 * several workstreams, with cards placed inside by hand. It claims nothing,
 * maps to no task, is never @-mentionable and never answers what fed something.
 *
 * Moving a section moves its drag-start contents without filing anything.
 * Sections never contain other sections. No derived membership is stored.
 *
 * Pure logic only. No React, no network, no writes.
 */

import { groupingDragSnapshot, moveGroupingContents, type GroupingDragMember } from "@/lib/board-region";

export const SECTION_FRAME_PREFIX = "section:";

export function isSectionFrameId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(SECTION_FRAME_PREFIX);
}

export function newSectionFrameId(key: string): string {
  return `${SECTION_FRAME_PREFIX}${key}`;
}

export function sectionTitle(label: string | null | undefined): string | null {
  const trimmed = (label ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const SECTION_TITLE_PLACEHOLDER = "Name this section";
export const SECTION_REMOVED_LINE = "Section removed. Workstreams and cards stay where they are.";

type SectionRect = { x: number; y: number; width: number; height: number };
type SectionFrame = SectionRect & { id: string };
type SectionCard = SectionFrame & { frame?: string | null | undefined };
type SectionDragSnapshot = { frames: GroupingDragMember[]; cards: GroupingDragMember[] };

/** Capture furniture and cards once, relative to the section's origin. */
export function sectionDragSnapshot(
  section: SectionRect,
  frames: readonly SectionFrame[],
  cards: readonly SectionCard[],
): SectionDragSnapshot {
  const frameMembers = groupingDragSnapshot(section, frames.filter((frame) => !isSectionFrameId(frame.id)));
  const frameIds = new Set(frameMembers.map((frame) => frame.id));
  const eligibleCards = cards.filter((card) => !card.frame || frameIds.has(card.frame));
  const geometricIds = new Set(groupingDragSnapshot(section, eligibleCards).map((card) => card.id));
  return {
    frames: frameMembers,
    cards: eligibleCards.filter((card) => geometricIds.has(card.id) || (card.frame && frameIds.has(card.frame)))
      .map((card) => ({ id: card.id, offsetX: card.x - section.x, offsetY: card.y - section.y })),
  };
}

/** Move both lists without changing their filing or dimensions. */
export function moveSectionContents<F extends { id: string; x: number; y: number }, C extends { id: string; x: number; y: number }>(
  frames: readonly F[],
  cards: readonly C[],
  snapshot: SectionDragSnapshot,
  sectionAt: { x: number; y: number },
): { frames: F[]; cards: C[] } {
  return {
    frames: moveGroupingContents(frames, snapshot.frames, sectionAt),
    cards: moveGroupingContents(cards, snapshot.cards, sectionAt),
  };
}

/** Choose the smallest containing outline, then the nearest title corner. */
export function containingSection<S extends SectionFrame>(
  point: { x: number; y: number } | SectionRect,
  sections: readonly S[],
): S | null {
  const x = point.x + ("width" in point ? point.width / 2 : 0);
  const y = point.y + ("height" in point ? point.height / 2 : 0);
  let closest: S | null = null;
  let area = Infinity;
  let distance = Infinity;
  for (const section of sections) {
    if (x < section.x || x > section.x + section.width || y < section.y || y > section.y + section.height) continue;
    const nextArea = section.width * section.height;
    const nextDistance = (x - section.x) ** 2 + (y - section.y) ** 2;
    if (nextArea < area || (nextArea === area && nextDistance < distance)) {
      closest = section;
      area = nextArea;
      distance = nextDistance;
    }
  }
  return closest;
}