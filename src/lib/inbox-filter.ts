import { linkBucket } from "./lineage-shared";
import type { WorkItemRow } from "./work-types";

export type InboxFilterKind = "placement" | "engagement";
export type InboxFilterSelection = "all" | "one";

export function inboxFilterMatches(item: WorkItemRow, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "unmapped") return item.visibility === "unmapped";
  if (filter === "claimed") return item.visibility === "mapped";
  return item.work_item_tasks[0]?.tasks?.engagements?.code === filter;
}

export function inboxFilterDims(
  filter: InboxFilterKind,
  selected: InboxFilterSelection,
  resultCount: number,
) {
  return {
    filter,
    selected,
    result_band: linkBucket(resultCount),
  } as const;
}