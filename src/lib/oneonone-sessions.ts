/**
 * PASS C · a 1:1 is a dated session with sticky notes on it.
 *
 * Pure helpers only: the date a person reads, the tilt a note sits at, and the
 * paper tint it is written on. No reads, no writes, no events.
 */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * "2026-09-18" reads as "Thu 18 Sep". Built from the parts rather than from a
 * local Date, so the day never slides by one in another time zone.
 */
export function sessionDateLabel(heldOn: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(heldOn);
  if (!match) return heldOn;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const weekday = DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
  return `${weekday} ${day} ${MONTHS[month - 1] ?? ""}`.trim();
}

/** Today, as the value a native date field expects. */
export function todayValue(now = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hash(id: string): number {
  let total = 0;
  for (let index = 0; index < id.length; index += 1) total = (total * 31 + id.charCodeAt(index)) % 9973;
  return total;
}

/** One to three degrees, either way, always the same for the same note. */
export const NOTE_TILTS = ["-rotate-1", "rotate-1", "-rotate-2", "rotate-2", "rotate-3", "-rotate-3"] as const;

export function noteTilt(id: string): string {
  return NOTE_TILTS[hash(id) % NOTE_TILTS.length] as string;
}

/** Three paper tints, rotated in order so a wall of notes is not one colour. */
export const NOTE_TINTS = ["var(--paper-5)", "var(--paper-2)", "var(--paper-1)"] as const;

export function noteTint(index: number): string {
  return NOTE_TINTS[index % NOTE_TINTS.length] as string;
}

/** The newest session by the date it is held on, then by when it was made. */
export function newestSessionId<T extends { id: string; held_on: string; created_at: string }>(
  sessions: readonly T[],
): string | null {
  const sorted = [...sessions].sort((a, b) =>
    a.held_on === b.held_on
      ? b.created_at.localeCompare(a.created_at)
      : b.held_on.localeCompare(a.held_on),
  );
  return sorted[0]?.id ?? null;
}
