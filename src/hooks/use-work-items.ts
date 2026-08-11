import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { MappedTask, WorkItemRow } from "@/lib/work-types";

export type WorkItemsResult = { items: WorkItemRow[]; mappingError: string | null };

export async function fetchWorkItems(): Promise<WorkItemsResult> {
  const { data, error } = await supabase
    .from("work_items")
    .select(
      "id, title, type, source, visibility, captured_at, content_ref, created_at_source, work_date, content_fidelity, source_vendor, orig_conversation_id, source_meta, meta",
    )
    .order("captured_at", { ascending: false });
  if (error) throw error;

  const items: WorkItemRow[] = (data ?? []).map((row) => ({
    ...row,
    meta: (row.meta ?? null) as WorkItemRow["meta"],
    source_meta: (row.source_meta ?? null) as WorkItemRow["source_meta"],
    work_item_tasks: [],
  }));
  if (items.length === 0) return { items, mappingError: null };

  // Mapping labels live behind engagement policies; if those reads fail we still
  // show the work itself rather than blanking the page.
  const mapping = await supabase
    .from("work_item_tasks")
    .select("work_item_id, task_id, tasks(id, name, engagement_id, engagements(id, code, title))")
    .in(
      "work_item_id",
      items.map((i) => i.id),
    );

  if (mapping.error) return { items, mappingError: mapping.error.message };

  const rows = (mapping.data ?? []) as unknown as (MappedTask & { work_item_id: string })[];
  for (const row of rows) {
    const item = items.find((i) => i.id === row.work_item_id);
    if (item) item.work_item_tasks.push({ task_id: row.task_id, tasks: row.tasks });
  }
  return { items, mappingError: null };
}

export function useWorkItems() {
  return useQuery({ queryKey: ["work-items"], queryFn: fetchWorkItems });
}
