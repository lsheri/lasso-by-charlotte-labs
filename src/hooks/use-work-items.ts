import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { WorkItemRow } from "@/lib/work-types";

const SELECT =
  "id, title, type, source, visibility, captured_at, content_ref, work_item_tasks(task_id, tasks(id, name, engagement_id, engagements(id, code, title)))";

export async function fetchWorkItems(): Promise<WorkItemRow[]> {
  const { data, error } = await supabase
    .from("work_items")
    .select(SELECT)
    .order("captured_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as WorkItemRow[];
}

export function useWorkItems() {
  return useQuery({ queryKey: ["work-items"], queryFn: fetchWorkItems });
}
