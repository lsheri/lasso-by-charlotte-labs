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

import { dayLabel } from "@/lib/push-boundary";
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
/**
 * SEC-FIX-1: what a section drag carries. Docked pieces are left out (they
 * follow their chat). A card filed in a frame that is not drawn, such as a
 * built-in lane, stands loose and joins by its centre; filing is never changed.
 * `shownFrames` are the frames drawn on the board.
 */
export function sectionDragMembers(
  section: SectionRect,
  shownFrames: readonly SectionFrame[],
  nodes: readonly SectionCard[],
  pieceIds: { has(id: string): boolean },
): SectionDragSnapshot {
  const shownFrameIds = new Set(shownFrames.map((entry) => entry.id));
  const cards = nodes
    .filter((node) => !pieceIds.has(node.id))
    .map((node) => (node.frame && !shownFrameIds.has(node.frame) ? { ...node, frame: null } : node));
  return sectionDragSnapshot(section, shownFrames, cards);
}

/* ------------------------------------------------------------------ */
/* SECD-1: a section's marker. A period or a number, never both.       */
/* Dates are calendar days ("YYYY-MM-DD") read in the reader's day.    */
/* ------------------------------------------------------------------ */

export type SectionPeriod = { periodStart: string; periodEnd: string };
export type SectionMarker = { periodStart: string | null; periodEnd: string | null; sequenceNo: number | null };

function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y as number, (m as number) - 1, d as number);
}

function toDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The single day containing `date`. */
export function dayOf(date: Date): SectionPeriod {
  const day = toDay(date);
  return { periodStart: day, periodEnd: day };
}

/** Monday to Sunday of the week containing `date`. */
export function weekOf(date: Date): SectionPeriod {
  const sinceMonday = (date.getDay() + 6) % 7;
  const monday = addDays(date, -sinceMonday);
  return { periodStart: toDay(monday), periodEnd: toDay(addDays(monday, 6)) };
}

/** First to last day of the month containing `date`. */
export function monthOf(date: Date): SectionPeriod {
  return {
    periodStart: toDay(new Date(date.getFullYear(), date.getMonth(), 1)),
    periodEnd: toDay(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

export function isWeekPeriod(period: { periodStart: string | null; periodEnd: string | null }): boolean {
  if (!period.periodStart || !period.periodEnd) return false;
  const start = parseDay(period.periodStart);
  return start.getDay() === 1 && toDay(addDays(start, 6)) === period.periodEnd;
}

function isMonthPeriod(period: SectionPeriod): boolean {
  const month = monthOf(parseDay(period.periodStart));
  return month.periodStart === period.periodStart && month.periodEnd === period.periodEnd;
}

/** Moves a week by seven days. Any other period comes back unchanged. */
export function shift(period: SectionPeriod, direction: "next" | "previous"): SectionPeriod {
  if (!isWeekPeriod(period)) return period;
  const step = direction === "next" ? 7 : -7;
  return {
    periodStart: toDay(addDays(parseDay(period.periodStart), step)),
    periodEnd: toDay(addDays(parseDay(period.periodEnd), step)),
  };
}

/** Setting a period clears the number. */
export function setPeriodMarker(period: SectionPeriod): SectionMarker {
  return { periodStart: period.periodStart, periodEnd: period.periodEnd, sequenceNo: null };
}

/** Setting a number clears both dates. */
export function setNumberMarker(sequenceNo: number): SectionMarker {
  return { periodStart: null, periodEnd: null, sequenceNo };
}

export function clearMarker(): SectionMarker {
  return { periodStart: null, periodEnd: null, sequenceNo: null };
}

/**
 * The line under a section title: "Week of 20 Oct", "3 to 14 Nov", "21 Oct",
 * "October", "#2", or null. Year only when it is not this year. Never a time.
 */
export function markerLabel(
  frame: { periodStart?: string | null; periodEnd?: string | null; sequenceNo?: number | null },
  now: Date = new Date(),
): string | null {
  if (frame.periodStart && frame.periodEnd) {
    const period = { periodStart: frame.periodStart, periodEnd: frame.periodEnd };
    const start = parseDay(period.periodStart);
    const end = parseDay(period.periodEnd);
    if (period.periodStart === period.periodEnd) return dayLabel(start, now);
    if (isWeekPeriod(period)) return `Week of ${dayLabel(start, now)}`;
    if (isMonthPeriod(period)) {
      const month = start.toLocaleDateString("en-GB", { month: "long" });
      return start.getFullYear() === now.getFullYear() ? month : `${month} ${start.getFullYear()}`;
    }
    const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
    return `${sameMonth ? String(start.getDate()) : dayLabel(start, now)} to ${dayLabel(end, now)}`;
  }
  if (typeof frame.sequenceNo === "number") return `#${frame.sequenceNo}`;
  return null;
}

/* SECD-2: finding a marked section. Pure ordering and choosing, no canvas. */
export type JumpSection = { id: string; periodStart?: string | null; periodEnd?: string | null; sequenceNo?: number | null };
type PeriodJump = { id: string; periodStart: string; periodEnd: string };

function periodSections(sections: JumpSection[]): PeriodJump[] {
  return sections
    .filter((s): s is JumpSection & PeriodJump => Boolean(s.periodStart && s.periodEnd))
    .map((s) => ({ id: s.id, periodStart: s.periodStart, periodEnd: s.periodEnd }))
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.periodEnd.localeCompare(b.periodEnd) || a.id.localeCompare(b.id));
}

function numberSections(sections: JumpSection[]): { id: string; sequenceNo: number }[] {
  return sections
    .filter((s): s is JumpSection & { sequenceNo: number } => typeof s.sequenceNo === "number" && !s.periodStart)
    .map((s) => ({ id: s.id, sequenceNo: s.sequenceNo }))
    .sort((a, b) => a.sequenceNo - b.sequenceNo || a.id.localeCompare(b.id));
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

export function hasPeriodSection(sections: JumpSection[]): boolean {
  return periodSections(sections).length > 0;
}

/** The section whose period covers `day`; otherwise the nearest by date (earlier wins a tie); null with no periods. */
export function sectionForDate(sections: JumpSection[], day: string): string | null {
  const periods = periodSections(sections);
  const covering = periods.find((s) => s.periodStart <= day && day <= s.periodEnd);
  if (covering) return covering.id;
  let best: { id: string; distance: number } | null = null;
  for (const s of periods) {
    const distance = s.periodEnd < day ? daysBetween(s.periodEnd, day) : daysBetween(day, s.periodStart);
    if (!best || distance < best.distance) best = { id: s.id, distance };
  }
  return best?.id ?? null;
}

/** Next or previous within the current section's own kind: periods by start, numbers by number. */
export function adjacentSection(sections: JumpSection[], currentId: string, direction: "next" | "previous"): string | null {
  const periods = periodSections(sections).map((s) => s.id);
  const numbers = numberSections(sections).map((s) => s.id);
  const order = periods.includes(currentId) ? periods : numbers.includes(currentId) ? numbers : null;
  if (!order) return null;
  const index = order.indexOf(currentId) + (direction === "next" ? 1 : -1);
  return order[index] ?? null;
}

/** The marked section under a board point (the viewport centre), or null. */
export function markedSectionAt(sections: (JumpSection & SectionRect)[], point: { x: number; y: number }): string | null {
  const hit = sections.find((s) => (s.periodStart || typeof s.sequenceNo === "number")
    && point.x >= s.x && point.x <= s.x + s.width && point.y >= s.y && point.y <= s.y + s.height);
  return hit?.id ?? null;
}

export function todayDay(now: Date = new Date()): string {
  return toDay(now);
}
