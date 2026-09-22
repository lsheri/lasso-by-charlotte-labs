/**
 * P4b: what the Home grid says about each engagement, and in what order.
 *
 * Every line on a card is read from the record. When there is no row saying a
 * person opened an engagement, the card says so plainly instead of borrowing
 * some other date and presenting it as the moment they last looked.
 */

import { formatDate } from "@/lib/work-types";

export type HomeGridEngagement = {
  id: string;
  code: string;
  title: string;
  clientLabel: string | null;
  /** When this person last opened the board, or null when they never have. */
  lastViewedAt: string | null;
  /** Pieces of work mapped into the engagement, or null when unknown. */
  workCount: number | null;
};

export const NEVER_OPENED_LABEL = "Not opened yet";

function at(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? 0 : value;
}

/**
 * Most recently opened first. Engagements with no row sit after every opened
 * one, keeping the order they arrived in rather than being sorted as if they
 * had been opened at the epoch.
 */
export function orderHomeGrid<T extends { lastViewedAt: string | null }>(cards: readonly T[]): T[] {
  const opened = cards.filter((card) => card.lastViewedAt !== null);
  const never = cards.filter((card) => card.lastViewedAt === null);
  const sorted = opened
    .map((card, index) => ({ card, index, when: at(card.lastViewedAt as string) }))
    .sort((a, b) => (b.when === a.when ? a.index - b.index : b.when - a.when))
    .map((entry) => entry.card);
  return [...sorted, ...never];
}

/** The time of day, in the short form the Ask transcript already uses. */
export function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * The established date convention (work-types formatDate) plus the time of
 * day, because a card says when you last opened something, not what day it
 * belongs to.
 */
export function lastOpenedLabel(lastViewedAt: string | null): string {
  if (!lastViewedAt) return NEVER_OPENED_LABEL;
  return `${formatDate(lastViewedAt)} · ${shortTime(lastViewedAt)}`;
}

/** Pieces of work per engagement, counted once each however many tasks hold them. */
export function countsByEngagement(
  rows: readonly { work_item_id: string; engagement_id: string }[],
): Map<string, number> {
  const seen = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = seen.get(row.engagement_id) ?? new Set<string>();
    set.add(row.work_item_id);
    seen.set(row.engagement_id, set);
  }
  return new Map([...seen].map(([id, set]) => [id, set.size]));
}
