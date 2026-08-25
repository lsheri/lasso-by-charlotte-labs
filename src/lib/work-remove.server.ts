/**
 * Removing work, in the two honest senses of the word.
 *
 * "Remove from this engagement" unpicks the mapping rows for THAT engagement's
 * workstreams only: nothing is deleted, and an item mapped into a second
 * engagement stays mapped there. "Delete this work" is permanent: the stored
 * bytes go first, then the row, and the database cascades the captured record.
 *
 * Both paths are owner-only. Access is confirmed through a caller-RLS read and
 * a profile match, exactly as the re-extract path does it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { briefScopeOf } from "@/lib/brief-shared";
import type { Database } from "@/integrations/supabase/types";

export type CallerClient = SupabaseClient<Database>;

/** Minimal storage surface, so the delete path can be exercised in tests. */
export type StorageRemover = {
  storage: { from: (bucket: string) => { remove: (paths: string[]) => Promise<unknown> } };
  from: CallerClient["from"];
};

export const NOT_AVAILABLE = "That item is not available to you.";

type OwnedItem = { id: string; owner_id: string; content_ref: string | null; meta: unknown };

/** One read, one comparison: the caller either owns the row or gets a 403. */
export async function readOwnItem(
  client: CallerClient,
  workItemId: string,
  profileId: string,
): Promise<OwnedItem> {
  const { data, error } = await client
    .from("work_items")
    .select("id, owner_id, content_ref, meta")
    .eq("id", workItemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(NOT_AVAILABLE);
  const item = data as unknown as OwnedItem;
  if (item.owner_id !== profileId) throw new Response("Forbidden", { status: 403 });
  return item;
}

export type RemoveResult = {
  removed: number;
  /** True when the item is still mapped into some other engagement. */
  still_mapped_elsewhere: boolean;
};

/**
 * Unpick this engagement's mappings. Remaining rows in each touched workstream
 * are renumbered from one when that workstream had a confirmed sequence, so the
 * order the person confirmed never grows a hole.
 */
export async function removeFromEngagement(
  client: CallerClient,
  input: { workItemId: string; engagementId: string; profileId: string },
): Promise<RemoveResult> {
  const item = await readOwnItem(client, input.workItemId, input.profileId);

  const tasksRes = await client.from("tasks").select("id").eq("engagement_id", input.engagementId);
  if (tasksRes.error) throw new Error(tasksRes.error.message);
  const taskIds = (tasksRes.data ?? []).map((row) => (row as { id: string }).id);
  if (taskIds.length === 0) return { removed: 0, still_mapped_elsewhere: false };

  const existing = await client
    .from("work_item_tasks")
    .select("task_id")
    .eq("work_item_id", input.workItemId)
    .in("task_id", taskIds);
  if (existing.error) throw new Error(existing.error.message);
  const touched = (existing.data ?? []).map((row) => (row as { task_id: string }).task_id);

  const del = await client
    .from("work_item_tasks")
    .delete()
    .eq("work_item_id", input.workItemId)
    .in("task_id", taskIds);
  if (del.error) throw new Error(del.error.message);

  for (const taskId of touched) await renumberTask(client, taskId);

  const rest = await client
    .from("work_item_tasks")
    .select("task_id")
    .eq("work_item_id", input.workItemId);
  if (rest.error) throw new Error(rest.error.message);
  const stillMapped = (rest.data ?? []).length > 0;

  if (!stillMapped) {
    const back = await client
      .from("work_items")
      .update({ visibility: "unmapped" })
      .eq("id", input.workItemId);
    if (back.error) throw new Error(back.error.message);
  }

  await clearBriefIfScoped(client, item, input.engagementId, taskIds);

  return { removed: touched.length, still_mapped_elsewhere: stillMapped };
}

/** Renumber a workstream's confirmed sequence so it stays 1..n with no gaps. */
async function renumberTask(client: CallerClient, taskId: string): Promise<void> {
  const { data, error } = await client
    .from("work_item_tasks")
    .select("work_item_id, step_no, step_confirmed")
    .eq("task_id", taskId)
    .order("step_no", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { work_item_id: string; step_no: number | null; step_confirmed: boolean }[];
  const confirmed = rows.filter((row) => row.step_confirmed);
  for (const [index, row] of confirmed.entries()) {
    if (row.step_no === index + 1) continue;
    await client
      .from("work_item_tasks")
      .update({ step_no: index + 1 })
      .eq("task_id", taskId)
      .eq("work_item_id", row.work_item_id);
  }
}

/**
 * A brief marker lives in work_items.meta. If it pointed at the engagement the
 * item just left, it would read as a brief for work that is no longer there.
 */
async function clearBriefIfScoped(
  client: CallerClient,
  item: OwnedItem,
  engagementId: string,
  taskIds: string[],
): Promise<void> {
  const scope = briefScopeOf(item.meta);
  if (!scope) return;
  const belongs =
    (scope.type === "engagement" && scope.id === engagementId) ||
    (scope.type === "task" && taskIds.includes(scope.id));
  if (!belongs) return;

  const meta = { ...((item.meta ?? {}) as Record<string, unknown>) };
  delete meta["role"];
  delete meta["brief_scope"];
  await client
    .from("work_items")
    .update({ meta: meta as never })
    .eq("id", item.id);
}

export type DeleteResult = { deleted: true; objects: number };

/**
 * Permanent. The stored original and the derived text sidecar go first, then
 * the row; every foreign key that points at a work item cascades or nulls, so
 * the captured record goes with it. A storage object that is already gone is
 * not an error: the point is that nothing is left behind.
 */
export async function deleteWorkItemRow(
  client: CallerClient,
  admin: StorageRemover,
  input: { workItemId: string; profileId: string },
): Promise<DeleteResult> {
  const item = await readOwnItem(client, input.workItemId, input.profileId);

  const meta = (item.meta ?? {}) as { text_ref?: unknown };
  const paths = [item.content_ref, typeof meta.text_ref === "string" ? meta.text_ref : null].filter(
    (path): path is string => typeof path === "string" && path.length > 0,
  );
  if (paths.length > 0) {
    try {
      await admin.storage.from("work-files").remove(paths);
    } catch {
      /* an object that is already missing must not block the delete */
    }
  }

  const del = await admin.from("work_items").delete().eq("id", input.workItemId);
  if (del.error) throw new Error(del.error.message);

  return { deleted: true, objects: paths.length };
}
