import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { isBriefItem } from "./brief-shared";
import type { EpisodeItemRole } from "./telemetry-v2-shared";

/**
 * A piece of work assembles itself. Mapping an item to a task is the valuable
 * product action, so it is also the instrumentation: the first mapping opens an
 * episode, later mappings join it. Nothing is backfilled.
 */

export type EpisodeRow = {
  id: string;
  title: string;
  objective: string | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  task_id: string | null;
};

type ItemShape = {
  id: string;
  type: string;
  source: string;
  meta?: unknown;
  source_meta?: unknown;
};

/** brief first, then the shape of the thing: talk, artifact, or evidence. */
export function itemRoleFor(item: ItemShape): EpisodeItemRole {
  if (isBriefItem(item)) return "brief";
  if (item.type === "ai_thread") return "conversation";
  const meta = (item.source_meta ?? {}) as { role?: string };
  const isArtifactType = item.type === "document" || item.type === "deck" || item.type === "sheet";
  if (isArtifactType && (meta.role === "attachment" || item.source === "upload")) return "artifact";
  if (isArtifactType) return "artifact";
  return "evidence";
}

export async function openEpisodeForTask(
  supabase: SupabaseClient<Database>,
  taskId: string,
  ownerId: string,
): Promise<EpisodeRow | null> {
  const { data, error } = await supabase
    .from("work_episodes")
    .select("id, title, objective, status, opened_at, closed_at, task_id")
    .eq("task_id", taskId)
    .eq("owner_id", ownerId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EpisodeRow | null) ?? null;
}

export async function episodeItemCount(
  supabase: SupabaseClient<Database>,
  episodeId: string,
): Promise<number> {
  const { count } = await supabase
    .from("episode_items")
    .select("work_item_id", { count: "exact", head: true })
    .eq("episode_id", episodeId);
  return count ?? 0;
}

/**
 * Attaches the mapped items to the task's open episode, creating that episode
 * the first time. An episode with no items is never created.
 */
export async function attachMappedItems(
  supabase: SupabaseClient<Database>,
  input: { taskId: string; ownerId: string; orgId: string; workItemIds: string[] },
): Promise<{
  episode: EpisodeRow;
  created: boolean;
  linked: { workItemId: string; role: EpisodeItemRole }[];
  itemCount: number;
} | null> {
  if (input.workItemIds.length === 0) return null;

  const { data: items, error: itemError } = await supabase
    .from("work_items")
    .select("id, type, source, meta, source_meta, owner_id")
    .in("id", input.workItemIds)
    .eq("owner_id", input.ownerId);
  if (itemError) throw new Error(itemError.message);
  const owned = (items ?? []) as (ItemShape & { owner_id: string })[];
  if (owned.length === 0) return null;

  let created = false;
  let episode = await openEpisodeForTask(supabase, input.taskId, input.ownerId);
  if (!episode) {
    const { data: task } = await supabase
      .from("tasks")
      .select("name")
      .eq("id", input.taskId)
      .maybeSingle();
    const { data: inserted, error: createError } = await supabase
      .from("work_episodes")
      .insert({
        org_id: input.orgId,
        owner_id: input.ownerId,
        task_id: input.taskId,
        title: task?.name ?? "This piece of work",
        status: "open",
      })
      .select("id, title, objective, status, opened_at, closed_at, task_id")
      .single();
    if (createError || !inserted) throw new Error(createError?.message ?? "episode_create_failed");
    episode = inserted as EpisodeRow;
    created = true;
  }

  const { data: existing } = await supabase
    .from("episode_items")
    .select("work_item_id")
    .eq("episode_id", episode.id);
  const already = new Set((existing ?? []).map((row) => row.work_item_id));

  const linked: { workItemId: string; role: EpisodeItemRole }[] = [];
  const rows = owned
    .filter((item) => !already.has(item.id))
    .map((item) => {
      const role = itemRoleFor(item);
      linked.push({ workItemId: item.id, role });
      return { episode_id: episode!.id, work_item_id: item.id, item_role: role };
    });
  if (rows.length > 0) {
    const { error: linkError } = await supabase.from("episode_items").insert(rows);
    if (linkError) throw new Error(linkError.message);
  }

  return {
    episode,
    created,
    linked,
    itemCount: already.size + rows.length,
  };
}

/** Unmapping detaches. The episode itself stays: it holds the history. */
export async function detachItems(
  supabase: SupabaseClient<Database>,
  workItemIds: string[],
): Promise<void> {
  if (workItemIds.length === 0) return;
  const { error } = await supabase.from("episode_items").delete().in("work_item_id", workItemIds);
  if (error) console.error("[episodes] detach failed:", error.message);
}
