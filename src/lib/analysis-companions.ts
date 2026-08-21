import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * The columns the confirm step needs to describe a piece of work honestly.
 * work_items has no created_at: the capture time is captured_at, and ordering
 * by anything else silently returns nothing.
 */
export const COMPANION_COLUMNS =
  "id, title, type, source, source_vendor, source_meta, meta, content_ref, captured_at";

/** The one column this query may order by. */
export const COMPANION_ORDER_COLUMN = "captured_at";

export const COMPANION_LIMIT = 60;

export type CompanionRow = {
  id: string;
  title: string;
  type: WorkItemRow["type"];
  source: WorkItemRow["source"];
  source_vendor: WorkItemRow["source_vendor"];
  source_meta: WorkItemRow["source_meta"];
  meta: WorkItemRow["meta"];
  content_ref?: string | null;
};

/**
 * The rest of the work mapped into the same engagement as one item. The
 * confirm step offers these as context the person can tick or untick.
 */
export async function fetchEngagementCompanions(
  supabase: SupabaseClient<Database>,
  itemId: string,
): Promise<CompanionRow[]> {
  const { data: mine } = await supabase
    .from("work_item_tasks")
    .select("tasks(engagement_id)")
    .eq("work_item_id", itemId);
  const engagementIds = Array.from(
    new Set(
      (mine ?? [])
        .map((row) => (row as { tasks: { engagement_id: string } | null }).tasks?.engagement_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (engagementIds.length === 0) return [];
  const { data: tasks } = await supabase.from("tasks").select("id").in("engagement_id", engagementIds);
  const taskIds = (tasks ?? []).map((task) => task.id);
  if (taskIds.length === 0) return [];
  const { data: links } = await supabase
    .from("work_item_tasks")
    .select("work_item_id")
    .in("task_id", taskIds);
  const ids = Array.from(
    new Set((links ?? []).map((row) => (row as { work_item_id: string }).work_item_id)),
  ).filter((id) => id !== itemId);
  if (ids.length === 0) return [];
  const { data: rows } = await supabase
    .from("work_items")
    .select(COMPANION_COLUMNS)
    .in("id", ids)
    .order(COMPANION_ORDER_COLUMN, { ascending: false })
    .limit(COMPANION_LIMIT);
  return (rows ?? []) as CompanionRow[];
}
