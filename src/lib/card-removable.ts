import { ownsWorkItem } from "@/lib/work-ownership";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * BRD-3a: only the person who owns the work behind a card takes it off the board.
 * Moved out of CanvasLabPage (TEST-1b) so the predicate can be tested directly;
 * the logic is unchanged, with the signed-in profile passed in explicitly.
 */
export function cardRemovable(
  profile: { id: string; role: string } | null | undefined,
  node: { workItemId?: string | null | undefined; authorProfileId?: string | null | undefined },
  item: WorkItemRow | undefined,
): boolean {
  if (!node.workItemId) return true;
  if (item) return ownsWorkItem(profile, item);
  return Boolean(node.authorProfileId) && node.authorProfileId === profile?.id;
}
