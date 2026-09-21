/**
 * When a pushed conversation actually happened.
 *
 * Nothing here invents a time. A message with no supplied timestamp
 * contributes nothing, and a conversation where nobody supplied one records
 * no source date at all. A later window can only move a recorded date
 * earlier, never later, because a window holds part of a conversation and
 * the conversation's own date is the earliest moment in the whole of it.
 */
import { defaultWorkDate } from "./source-dates";

export type SuppliedTime = string | null | undefined;

function parsed(value: SuppliedTime): number | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const input = /^\d+$/.test(value) ? Number(value) : value;
  const time = new Date(input as string | number).getTime();
  return Number.isNaN(time) ? null : time;
}

/** The earliest usable supplied timestamp, exactly as it was supplied. */
export function earliestSuppliedTs(values: readonly SuppliedTime[]): string | null {
  let best: string | null = null;
  let bestTime = Number.POSITIVE_INFINITY;
  for (const value of values) {
    const time = parsed(value);
    if (time === null) continue;
    if (time < bestTime) {
      bestTime = time;
      best = value as string;
    }
  }
  return best;
}

export type SourceTimeFields = {
  created_at_source: string | null;
  work_date: string | null;
  ts_precision: "source" | "capture";
};

/**
 * The work item's date fields for a push, given whatever is already recorded
 * and the timestamps this window supplied.
 */
export function pushSourceTimeFields(
  existing: { created_at_source?: SuppliedTime; work_date?: SuppliedTime } | null | undefined,
  supplied: readonly SuppliedTime[],
): SourceTimeFields {
  const incoming = earliestSuppliedTs(supplied);
  const recorded = existing?.created_at_source ?? null;
  const earliest = earliestSuppliedTs([recorded, incoming]);
  return {
    created_at_source: earliest,
    work_date: defaultWorkDate(existing?.work_date ?? null, earliest),
    ts_precision: earliest ? "source" : "capture",
  };
}
