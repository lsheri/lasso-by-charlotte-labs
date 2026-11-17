import { isDeliverableType } from "@/lib/lineage-shared";

/**
 * Shown to client (Liam, 16 Nov, firm brain phase 1). A deliverable on a board can be marked as put in front of the
 * client, with the date and an optional occasion. The database keeps the item's content hash at that moment, so the
 * version the client saw is known later. Marks change only through mark_client_showing and unmark_client_showing.
 */
export type ClientShowing = {
  id: string;
  workItemId: string;
  shownOn: string;
  occasion: string | null;
};

export const CLIENT_SHOWN_COPY = {
  menu: "Mark as shown to client",
  menuAgain: "Shown to client…",
  title: "Shown to client",
  helper: "Record when this went in front of the client. Everyone on the board sees it.",
  dateLabel: "Date shown",
  occasionLabel: "Occasion (optional)",
  occasionPlaceholder: "SteerCo 3",
  save: "Mark as shown",
  cancel: "Cancel",
  remove: "Remove",
  earlier: "Already marked",
  failed: "Could not save the mark. Try again.",
  removeFailed: "Could not remove the mark. Try again.",
  futureDate: "Pick today or an earlier date.",
  longOccasion: "Keep the occasion under 120 characters.",
} as const;

export const MAX_OCCASION_CHARS = 120;

/** Only finished work is presented to a client: decks, documents and the other deliverable types. */
export function canMarkShown(type: string | null | undefined): boolean {
  return Boolean(type) && isDeliverableType(type as string);
}

/** Today as YYYY-MM-DD in the viewer's own calendar. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function validateShowing(input: { shownOn: string; occasion: string }, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.shownOn) || input.shownOn > today) return CLIENT_SHOWN_COPY.futureDate;
  if (input.occasion.trim().length > MAX_OCCASION_CHARS) return CLIENT_SHOWN_COPY.longOccasion;
  return null;
}

/** "12 Nov" for a date-only value, read as a calendar date so no time zone moves it. */
export function shownDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

/** Newest first, so the line names the latest showing. */
export function sortShowings(marks: ClientShowing[]): ClientShowing[] {
  return [...marks].sort((a, b) => b.shownOn.localeCompare(a.shownOn));
}

/** The quiet line on the card: one showing names its date (and occasion), several say how many. */
export function shownLine(marks: ClientShowing[]): string | null {
  if (marks.length === 0) return null;
  const [latest] = sortShowings(marks);
  if (marks.length === 1) return `Shown to client, ${shownDate(latest!.shownOn)}${latest!.occasion ? `, ${latest!.occasion}` : ""}`;
  return `Shown to client ${marks.length} times, last ${shownDate(latest!.shownOn)}`;
}

export function showingsByItem(rows: { id: string; work_item_id: string; shown_on: string; occasion: string | null }[]): Map<string, ClientShowing[]> {
  const map = new Map<string, ClientShowing[]>();
  for (const row of rows) {
    const list = map.get(row.work_item_id) ?? [];
    list.push({ id: row.id, workItemId: row.work_item_id, shownOn: row.shown_on, occasion: row.occasion });
    map.set(row.work_item_id, list);
  }
  return map;
}
