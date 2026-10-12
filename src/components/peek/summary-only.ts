/**
 * SH-3b: the reading pane's line for a viewer who was given summaries only.
 * Owners keep the reader's own note.
 */

import type { WorkItemRow } from "@/lib/work-types";

export const SUMMARY_ONLY_LINE =
  "Shared as a summary. The full conversation stays with the person who had it.";

export function isItemOwner(item: Pick<WorkItemRow, "owner_id">, profileId: string | undefined): boolean {
  return Boolean(profileId) && item.owner_id === profileId;
}

export function summaryOnlyLine(
  reason: string | null | undefined,
  item: Pick<WorkItemRow, "owner_id">,
  profileId: string | undefined,
): string | null {
  return reason === "empty_thread" && !isItemOwner(item, profileId) ? SUMMARY_ONLY_LINE : null;
}
