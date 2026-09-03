/**
 * Pass 161: reading notes written about your own work.
 *
 * Everything here is pure. A note's words never reach a band: only how many
 * were shown, how old the newest one is, and how long after the work a note
 * was written.
 */

export const NOTES_SHOWN_BANDS = ["0", "1", "2-5", "6+"] as const;
export type NotesShownBand = (typeof NOTES_SHOWN_BANDS)[number];

export const NEWEST_AGE_BANDS = ["under_1d", "1-7d", "8-30d", "30d+"] as const;
export type NewestAgeBand = (typeof NEWEST_AGE_BANDS)[number];

export const DAYS_TO_NOTE_BANDS = [
  "same_day",
  "1-3d",
  "4-7d",
  "8-30d",
  "30d+",
  "unknown",
] as const;
export type DaysToNoteBand = (typeof DAYS_TO_NOTE_BANDS)[number];

/** 0 · 1 · 2-5 · 6+ notes on the surface just opened. */
export function notesShownBand(count: number): NotesShownBand {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n === 0) return "0";
  if (n === 1) return "1";
  if (n <= 5) return "2-5";
  return "6+";
}

function ms(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

const DAY = 86400000;

/**
 * under_1d · 1-7d · 8-30d · 30d+, the age of the newest note shown.
 * Nothing to read means the oldest band is never guessed: "30d+" is only
 * returned for a real date, and an unreadable one reads as "under_1d".
 */
export function newestAgeBand(
  newest: Date | string | number | null | undefined,
  now: Date | string | number = new Date(),
): NewestAgeBand {
  const then = ms(newest);
  const at = ms(now) ?? Date.now();
  if (then === null) return "under_1d";
  const days = Math.max(0, (at - then) / DAY);
  if (days < 1) return "under_1d";
  if (days <= 7) return "1-7d";
  if (days <= 30) return "8-30d";
  return "30d+";
}

/**
 * same_day · 1-3d · 4-7d · 8-30d · 30d+ between the last thing that happened
 * in the work and the note being written. Missing or unreadable dates band to
 * "unknown" rather than being guessed into the lowest bucket.
 */
export function daysToNoteBand(
  activityAt: Date | string | number | null | undefined,
  noteAt: Date | string | number | null | undefined,
): DaysToNoteBand {
  const from = ms(activityAt);
  const to = ms(noteAt);
  if (from === null || to === null) return "unknown";
  const days = Math.max(0, (to - from) / DAY);
  if (days < 1) return "same_day";
  if (days <= 3) return "1-3d";
  if (days <= 7) return "4-7d";
  if (days <= 30) return "8-30d";
  return "30d+";
}

/** A note is marked new when it landed after the last time this view opened. */
export function isNewSince(
  createdAt: string,
  lastSeen: string | null | undefined,
): boolean {
  if (!lastSeen) return false;
  return createdAt > lastSeen;
}

const SEEN_PREFIX = "lasso.coachnotes_seen.";

export function readNotesSeen(surface: string): string | null {
  try {
    return window.localStorage.getItem(SEEN_PREFIX + surface);
  } catch {
    return null;
  }
}

export function writeNotesSeen(surface: string, iso: string): void {
  try {
    window.localStorage.setItem(SEEN_PREFIX + surface, iso);
  } catch {
    /* remembering the last visit is a nicety, not a requirement */
  }
}
