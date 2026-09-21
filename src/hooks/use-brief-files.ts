import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { WorkItemRow } from "@/lib/work-types";

const COLUMNS =
  "id, title, type, source, visibility, captured_at, content_ref, created_at_source, work_date, content_fidelity, source_vendor, orig_conversation_id, source_meta, meta";

export type BriefFile = { workItemId: string; item: WorkItemRow | null };

/** Files that came in with the brief when the engagement was created. */
export async function fetchBriefFiles(engagementId: string): Promise<BriefFile[]> {
  const { data, error } = await supabase
    .from("engagement_brief_files")
    .select(`work_item_id, created_at, work_items(${COLUMNS})`)
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const item = (row as { work_items?: unknown }).work_items as WorkItemRow | null;
    return {
      workItemId: (row as { work_item_id: string }).work_item_id,
      item: item ? ({ ...item, work_item_tasks: [] } as WorkItemRow) : null,
    };
  });
}

export function useBriefFiles(engagementId: string | undefined) {
  return useQuery({
    queryKey: ["engagement-brief-files", engagementId ?? ""],
    queryFn: () => fetchBriefFiles(engagementId as string),
    enabled: Boolean(engagementId),
  });
}

export function useInvalidateBriefFiles() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["engagement-brief-files"] });
}

/** Record documents as part of the engagement's context. Membership rules decide. */
export async function addBriefFiles(input: { engagementId: string; workItemIds: string[]; profileId: string }): Promise<void> {
  if (input.workItemIds.length === 0) return;
  const rows = input.workItemIds.map((workItemId) => ({
    engagement_id: input.engagementId,
    work_item_id: workItemId,
    created_by: input.profileId,
  }));
  const { error } = await supabase.from("engagement_brief_files").upsert(rows, { onConflict: "engagement_id,work_item_id" });
  if (error) throw error;
}

/**
 * Take a document out of the engagement's context. The work item itself is
 * untouched, and its card stays on the board.
 */
export async function removeBriefFile(engagementId: string, workItemId: string): Promise<void> {
  const { error } = await supabase
    .from("engagement_brief_files")
    .delete()
    .eq("engagement_id", engagementId)
    .eq("work_item_id", workItemId);
  if (error) throw error;
}
