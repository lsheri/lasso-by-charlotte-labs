import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { countsByEngagement } from "@/lib/home-grid";

/**
 * How many pieces of work sit in each engagement, in one bounded read over the
 * engagements the person can already see.
 */
export async function fetchEngagementWorkCounts(
  engagementIds: readonly string[],
): Promise<Map<string, number>> {
  if (engagementIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("work_item_tasks")
    .select("work_item_id, tasks!inner(engagement_id)")
    .in("tasks.engagement_id", [...engagementIds]);
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    work_item_id: string;
    tasks: { engagement_id: string } | null;
  }[];
  return countsByEngagement(
    rows
      .filter((row) => row.tasks?.engagement_id)
      .map((row) => ({
        work_item_id: row.work_item_id,
        engagement_id: row.tasks!.engagement_id,
      })),
  );
}

export function useEngagementWorkCounts(engagementIds: readonly string[] | undefined) {
  const ids = [...(engagementIds ?? [])].sort();
  return useQuery({
    queryKey: ["engagement-work-counts", ids],
    queryFn: () => fetchEngagementWorkCounts(ids),
    enabled: Boolean(engagementIds),
  });
}
