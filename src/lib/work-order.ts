/**
 * One ordering rule for every list of work a person reads.
 *
 * A piece of work has two different times attached to it: when it happened,
 * and when it reached Lasso. About half the AI conversations in the record
 * carry a real date and half carry only an arrival time, and nothing here
 * invents the difference. The date a list orders by is the date it shows, and
 * a row always says which of the two it is reading.
 */

export type WorkDateKind = "source" | "arrival";

export type ResolvedWorkDate = {
  /** The date the ordering used. */
  iso: string;
  kind: WorkDateKind;
  /** True when there is no date for when the work happened, only its arrival. */
  byArrival: boolean;
};

export type DatedWorkItem = {
  work_date?: string | null | undefined;
  created_at_source?: string | null | undefined;
  captured_at: string;
};

/**
 * When the work happened, when the record knows it. A date a person set on the
 * piece, else the date carried in from the source, else the arrival time,
 * which is marked as such and never presented as when the work happened.
 */
export function resolveWorkDate(item: DatedWorkItem): ResolvedWorkDate {
  const stated = item.work_date ?? item.created_at_source ?? null;
  if (stated) return { iso: stated, kind: "source", byArrival: false };
  return { iso: item.captured_at, kind: "arrival", byArrival: true };
}

function time(iso: string): number {
  const at = new Date(iso).getTime();
  return Number.isNaN(at) ? 0 : at;
}

/** Newest first by the resolved date. Equal dates keep the order given. */
export function orderByWorkDate<T extends DatedWorkItem>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index, at: time(resolveWorkDate(item).iso) }))
    .sort((a, b) => (b.at === a.at ? a.index - b.index : b.at - a.at))
    .map((entry) => entry.item);
}

/** The day a row falls on, so grouping and ordering can never disagree. */
export function resolvedDayKey(item: DatedWorkItem): string {
  return resolveWorkDate(item).iso.slice(0, 10);
}
