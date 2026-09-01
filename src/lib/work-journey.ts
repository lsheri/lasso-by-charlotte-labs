/**
 * Pass 153: the shape of how a piece of work came to be, said in bands.
 *
 * Everything here is a pure function over counts and dates. No titles, no
 * text, no raw counts ever leave: a count is read only far enough to name a
 * band, a date only far enough to name a span of days.
 */

export const THREADS_BANDS = ["0", "1", "2-3", "4-6", "7+"] as const;
export type ThreadsBand = (typeof THREADS_BANDS)[number];

export const TOTAL_TURNS_BANDS = ["0", "1-5", "6-15", "16-40", "41-100", "100+"] as const;
export type TotalTurnsBand = (typeof TOTAL_TURNS_BANDS)[number];

export const TOOLS_COUNT_BANDS = ["0", "1", "2", "3+"] as const;
export type ToolsCountBand = (typeof TOOLS_COUNT_BANDS)[number];

export const DAYS_TO_SHIP_BANDS = ["same_day", "2-3d", "4-7d", "8-30d", "30d+"] as const;
export type DaysToShipBand = (typeof DAYS_TO_SHIP_BANDS)[number];

function whole(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/** 0 · 1 · 2-3 · 4-6 · 7+ linked conversations. */
export function threadsBand(count: number): ThreadsBand {
  const n = whole(count);
  if (n === 0) return "0";
  if (n === 1) return "1";
  if (n <= 3) return "2-3";
  if (n <= 6) return "4-6";
  return "7+";
}

/** 0 · 1-5 · 6-15 · 16-40 · 41-100 · 100+ turns, summed across conversations. */
export function totalTurnsBand(count: number): TotalTurnsBand {
  const n = whole(count);
  if (n === 0) return "0";
  if (n <= 5) return "1-5";
  if (n <= 15) return "6-15";
  if (n <= 40) return "16-40";
  if (n <= 100) return "41-100";
  return "100+";
}

/** 0 · 1 · 2 · 3+ distinct named tools. */
export function toolsCountBand(count: number): ToolsCountBand {
  const n = whole(count);
  if (n === 0) return "0";
  if (n === 1) return "1";
  if (n === 2) return "2";
  return "3+";
}

/** The UTC calendar day a moment falls on, as a whole number of days. */
function utcDayIndex(value: Date | string | number): number | null {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
}

/**
 * same_day · 2-3d · 4-7d · 8-30d · 30d+, counted between UTC calendar dates.
 * An unreadable date reads as same_day: the lowest bucket, never a guess.
 */
export function daysToShipBand(
  start: Date | string | number | null | undefined,
  ship: Date | string | number | null | undefined,
): DaysToShipBand {
  if (start == null || ship == null) return "same_day";
  const from = utcDayIndex(start);
  const to = utcDayIndex(ship);
  if (from === null || to === null) return "same_day";
  const days = Math.max(0, to - from);
  if (days === 0) return "same_day";
  if (days <= 2) return "2-3d";
  if (days <= 6) return "4-7d";
  if (days <= 29) return "8-30d";
  return "30d+";
}

export type JourneyInput = {
  threads: number;
  totalTurns: number;
  toolCount: number;
  earliestAt?: Date | string | number | null | undefined;
  shippedAt?: Date | string | number | null | undefined;
};

export type JourneyBands = {
  threads_band: ThreadsBand;
  total_turns_band: TotalTurnsBand;
  tools_count_band: ToolsCountBand;
  days_to_ship_band: DaysToShipBand;
};

/** The whole banded payload, from counts and dates alone. */
export function journeyBands(input: JourneyInput): JourneyBands {
  return {
    threads_band: threadsBand(input.threads),
    total_turns_band: totalTurnsBand(input.totalTurns),
    tools_count_band: toolsCountBand(input.toolCount),
    days_to_ship_band: daysToShipBand(input.earliestAt ?? null, input.shippedAt ?? null),
  };
}

export function isJourneyBands(value: unknown): value is JourneyBands {
  const v = (value ?? {}) as Partial<JourneyBands>;
  return (
    (THREADS_BANDS as readonly string[]).includes(v.threads_band as string) &&
    (TOTAL_TURNS_BANDS as readonly string[]).includes(v.total_turns_band as string) &&
    (TOOLS_COUNT_BANDS as readonly string[]).includes(v.tools_count_band as string) &&
    (DAYS_TO_SHIP_BANDS as readonly string[]).includes(v.days_to_ship_band as string)
  );
}
