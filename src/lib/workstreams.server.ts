/**
 * Deleting a workstream. The cascade on work_item_tasks is not enough on its
 * own: work that was only ever mapped here would keep saying "mapped" while
 * nothing points at it. So the rule from pass 102's removeFromEngagement is
 * reused here verbatim, item by item, and the task-scoped brief markers that
 * pointed at this workstream are cleared too.
 *
 * Nothing about the work itself is deleted. Only the column goes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { briefScopeOf } from "@/lib/brief-shared";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export const WORKSTREAM_NOT_AVAILABLE = "That workstream is not available to you.";

export type DeleteWorkstreamResult = {
  deleted: true;
  /** Items that went back to the Work pile because nothing else maps them. */
  unmapped: number;
  /** Items still mapped in another workstream or engagement. */
  still_mapped: number;
};

export async function deleteWorkstreamRow(
  client: Client,
  input: { taskId: string },
): Promise<DeleteWorkstreamResult> {
  const task = await client
    .from("tasks")
    .select("id, engagement_id")
    .eq("id", input.taskId)
    .maybeSingle();
  if (task.error) throw new Error(task.error.message);
  if (!task.data) throw new Error(WORKSTREAM_NOT_AVAILABLE);

  const links = await client
    .from("work_item_tasks")
    .select("work_item_id")
    .eq("task_id", input.taskId);
  if (links.error) throw new Error(links.error.message);
  const itemIds = [
    ...new Set((links.data ?? []).map((row) => (row as { work_item_id: string }).work_item_id)),
  ];

  const del = await client.from("tasks").delete().eq("id", input.taskId);
  if (del.error) throw new Error(del.error.message);

  let unmapped = 0;
  let stillMapped = 0;
  for (const itemId of itemIds) {
    const rest = await client
      .from("work_item_tasks")
      .select("task_id")
      .eq("work_item_id", itemId);
    if (rest.error) throw new Error(rest.error.message);
    if ((rest.data ?? []).length > 0) {
      stillMapped += 1;
      continue;
    }
    const back = await client
      .from("work_items")
      .update({ visibility: "unmapped" })
      .eq("id", itemId);
    if (back.error) throw new Error(back.error.message);
    unmapped += 1;
  }

  await clearTaskBriefMarkers(client, itemIds, input.taskId);

  return { deleted: true, unmapped, still_mapped: stillMapped };
}

/** A brief marked for this workstream cannot go on pointing at a dead id. */
async function clearTaskBriefMarkers(
  client: Client,
  itemIds: string[],
  taskId: string,
): Promise<void> {
  if (itemIds.length === 0) return;
  const items = await client.from("work_items").select("id, meta").in("id", itemIds);
  if (items.error) throw new Error(items.error.message);
  for (const row of (items.data ?? []) as { id: string; meta: unknown }[]) {
    const scope = briefScopeOf(row.meta);
    if (!scope || scope.type !== "task" || scope.id !== taskId) continue;
    const meta = { ...((row.meta ?? {}) as Record<string, unknown>) };
    delete meta["role"];
    delete meta["brief_scope"];
    const update = await client
      .from("work_items")
      .update({ meta: meta as never })
      .eq("id", row.id);
    if (update.error) throw new Error(update.error.message);
  }
}

/** Two neighbouring workstreams trade places. Order is position, then age. */
export function swappedPositions(
  ordered: { id: string; position: number | null }[],
  taskId: string,
  direction: "left" | "right",
): { id: string; position: number }[] | null {
  const index = ordered.findIndex((task) => task.id === taskId);
  if (index === -1) return null;
  const otherIndex = direction === "left" ? index - 1 : index + 1;
  const self = ordered[index];
  const other = ordered[otherIndex];
  if (!self || !other) return null;
  return [
    { id: self.id, position: otherIndex },
    { id: other.id, position: index },
  ];
}
