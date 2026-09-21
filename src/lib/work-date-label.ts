/**
 * The one way a row says its date.
 *
 * The date a list orders by is the date every row on it shows, so the label
 * comes from the same resolution the ordering uses. When all the record has is
 * an arrival time, the row says so instead of passing it off as when the work
 * happened.
 */

import { resolveWorkDate, type DatedWorkItem } from "@/lib/work-order";
import { formatDate } from "@/lib/work-types";

export function workDateLabel(
  item: DatedWorkItem,
  format: (iso: string) => string = formatDate,
): string {
  const when = resolveWorkDate(item);
  return when.byArrival ? `added ${format(when.iso)}` : format(when.iso);
}
