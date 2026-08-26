/**
 * The only place ordering and remapping are written.
 *
 * Pass 87 extracted these three sequences out of TaskWorkflow and MapDialog so
 * the engagement canvas can write exactly what the list rows have always
 * written: same calls, same order, same payloads, same telemetry. Nothing here
 * batches or reshapes a write; the round trips are deliberately the same ones.
 */
import { supabase as defaultClient } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";

/** Just enough of the client to write these three sequences. */
export type OrderClient = typeof defaultClient;

export type WriteResult = { error: string | null };

/**
 * Confirm a sequence for one workstream: row by row, in the order given.
 * The item ids are the confirmed order, first is step 1.
 */
export async function persistOrder(input: {
  client?: OrderClient;
  taskId: string;
  workItemIds: string[];
  orgId: string | undefined;
  onChanged: () => Promise<void> | void;
}): Promise<WriteResult> {
  const client = input.client ?? defaultClient;
  for (const [index, workItemId] of input.workItemIds.entries()) {
    const { error } = await client
      .from("work_item_tasks")
      .update({ step_no: index + 1, step_confirmed: true })
      .eq("task_id", input.taskId)
      .eq("work_item_id", workItemId);
    if (error) return { error: error.message };
  }
  if (input.orgId) logEvent("workflow.reordered", input.orgId, { item_count: input.workItemIds.length });
  await input.onChanged();
  return { error: null };
}

/** Drop the confirmed sequence for one workstream and fall back to date order. */
export async function resetOrder(input: {
  client?: OrderClient;
  taskId: string;
  orgId: string | undefined;
  onChanged: () => Promise<void> | void;
}): Promise<WriteResult> {
  const client = input.client ?? defaultClient;
  const { error } = await client
    .from("work_item_tasks")
    .update({ step_no: null, step_confirmed: false })
    .eq("task_id", input.taskId);
  if (error) return { error: error.message };
  if (input.orgId) logEvent("workflow.reset", input.orgId, {});
  await input.onChanged();
  return { error: null };
}

export type RemapTarget = { id: string; type: string; source: string };

/**
 * Move one or more pieces of work onto a workstream. Mapping is the product
 * action that assembles the piece of work, so the episode is resynced and the
 * item becomes mapped in the same sequence.
 */
export async function remapItems(input: {
  client?: OrderClient;
  targets: RemapTarget[];
  taskId: string;
  profile: { id: string; org_id: string };
  detachEpisode: (args: { data: { work_item_ids: string[] } }) => Promise<unknown>;
  syncEpisode: (args: {
    data: { task_id: string; work_item_ids: string[]; profile_id: string };
  }) => Promise<unknown>;
  invalidate: (queryKey: readonly unknown[]) => Promise<void> | void;
}): Promise<WriteResult> {
  const client = input.client ?? defaultClient;
  const { targets, taskId, profile } = input;
  const ids = targets.map((t) => t.id);

  const cleanup = await client.from("work_item_tasks").delete().in("work_item_id", ids);
  if (cleanup.error) return { error: cleanup.error.message };

  const link = await client
    .from("work_item_tasks")
    .insert(ids.map((workItemId) => ({ work_item_id: workItemId, task_id: taskId })));
  if (link.error) return { error: link.error.message };

  const update = await client.from("work_items").update({ visibility: "mapped" }).in("id", ids);
  if (update.error) return { error: update.error.message };

  await input.detachEpisode({ data: { work_item_ids: ids } });
  await input.syncEpisode({ data: { task_id: taskId, work_item_ids: ids, profile_id: profile.id } });
  await input.invalidate(["episode", taskId]);

  for (const target of targets) {
    logEvent("workitem.mapped", profile.org_id, { type: target.type, source: target.source });
  }
  await input.invalidate(["work-items"]);
  await input.invalidate(["engagement"]);
  return { error: null };
}
