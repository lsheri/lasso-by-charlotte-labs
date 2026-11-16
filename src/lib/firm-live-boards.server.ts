import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { briefLine, type FirmLiveBoard } from "./firm-live-boards-shared";

/** Called only behind requireFirmView, with its admin client and the caller's own org. */
export async function listFirmLiveBoards(supabaseAdmin: SupabaseClient<Database>, orgId: string): Promise<FirmLiveBoard[]> {
  const { data: boards, error } = await supabaseAdmin
    .from("engagements")
    .select("id, title, brief, shared_with_firm_at, owner_id, clients(name, quick_folder)")
    .eq("org_id", orgId)
    .eq("shared_with_firm", true)
    .is("archived_at", null)
    .order("shared_with_firm_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = boards ?? [];
  if (rows.length === 0) return [];

  const ownerIds = [...new Set(rows.map((row) => row.owner_id).filter((id): id is string => Boolean(id)))];
  const { data: owners } = ownerIds.length
    ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", ownerIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const ownerName = new Map((owners ?? []).map((person) => [person.id, person.display_name]));

  // Placed (mapped) work only: private and unplaced items never count, and never show.
  const { data: placed } = await supabaseAdmin
    .from("work_item_tasks")
    .select("work_item_id, tasks!inner(engagement_id), work_items!inner(visibility)")
    .in("tasks.engagement_id", rows.map((row) => row.id))
    .eq("work_items.visibility", "mapped");
  const pieces = new Map<string, Set<string>>();
  for (const row of (placed ?? []) as unknown as { work_item_id: string; tasks: { engagement_id: string } }[]) {
    const set = pieces.get(row.tasks.engagement_id) ?? new Set<string>();
    set.add(row.work_item_id);
    pieces.set(row.tasks.engagement_id, set);
  }

  return rows.map((row) => {
    const client = row.clients as { name: string; quick_folder: boolean } | null;
    return {
      id: row.id,
      title: row.title,
      client: client && !client.quick_folder ? client.name : null,
      owner: row.owner_id ? (ownerName.get(row.owner_id) ?? null) : null,
      sharedAt: row.shared_with_firm_at,
      brief: briefLine(row.brief),
      pieces: pieces.get(row.id)?.size ?? 0,
    };
  });
}
