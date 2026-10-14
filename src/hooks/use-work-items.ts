import { useQuery } from "@tanstack/react-query";

import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import type { MappedTask, WorkItemRow } from "@/lib/work-types";

export type WorkItemsResult = { items: WorkItemRow[]; mappingError: string | null };

export async function fetchWorkItems(orgId: string): Promise<WorkItemsResult> {
  const itemsRes = await supabase
    .from("work_items")
    .select(
      "id, owner_id, client_id, title, display_title, type, source, visibility, captured_at, content_ref, created_at_source, work_date, content_fidelity, source_vendor, orig_conversation_id, ungrouped_at, source_meta, meta",
    )
    .eq("org_id", orgId)
    .order("captured_at", { ascending: false });
  if (itemsRes.error) throw itemsRes.error;

  const items: WorkItemRow[] = (itemsRes.data ?? []).map((row) => ({
    ...row,
    meta: (row.meta ?? null) as WorkItemRow["meta"],
    source_meta: (row.source_meta ?? null) as WorkItemRow["source_meta"],
    work_item_tasks: [],
  }));
  if (items.length === 0) return { items, mappingError: null };

  // Mapping labels live behind engagement policies; if those reads fail we still
  // show the work itself rather than blanking the page. Row security on
  // work_items (work_owner_all, via is_my_active_profile(owner_id)) also admits
  // support-granted and coach-visible rows from OTHER workspaces, so the items
  // read above filters by the active workspace itself rather than trusting row
  // security to do it. This placement read is joined in memory by work_item_id,
  // so only placements for this workspace's items attach. Enumerating work item
  // ids in the query string made the URL grow with the size of a person's
  // record until the request failed, so the read carries no id list.
  const mapping = await supabase
    .from("work_item_tasks")
    .select(
      "work_item_id, task_id, tasks(id, name, engagement_id, is_wrap, engagements(id, code, title, client_label, clients(id, name, quick_folder)))",
    );
  if (mapping.error) return { items, mappingError: mapping.error.message };

  const byId = new Map(items.map((item) => [item.id, item]));
  const rows = (mapping.data ?? []) as unknown as (MappedTask & { work_item_id: string })[];
  for (const row of rows) {
    const item = byId.get(row.work_item_id);
    if (item) item.work_item_tasks.push({ task_id: row.task_id, tasks: row.tasks });
  }
  return { items, mappingError: null };
}

export function useWorkItems() {
  const { data: profile } = useProfile();
  const orgId = profile?.org_id ?? null;
  return useQuery({
    queryKey: ["work-items", orgId],
    queryFn: () => fetchWorkItems(orgId as string),
    // No active workspace means no read: never fall back to an unfiltered one.
    enabled: Boolean(orgId),
  });
}
