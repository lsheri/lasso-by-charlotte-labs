import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { briefScopeOf, type BriefScope } from "@/lib/brief-shared";
import type { WorkItemRow } from "@/lib/work-types";

export type BriefItem = WorkItemRow & { brief_scope: BriefScope };

const COLUMNS =
  "id, title, type, source, visibility, captured_at, content_ref, created_at_source, work_date, content_fidelity, source_vendor, orig_conversation_id, source_meta, meta";

/** Every item this person has marked as a brief, whatever it briefs. */
export async function fetchBriefs(profileId: string): Promise<BriefItem[]> {
  const { data, error } = await supabase
    .from("work_items")
    .select(COLUMNS)
    .eq("owner_id", profileId)
    .eq("meta->>role", "brief");
  if (error) throw error;
  const rows = (data ?? []) as unknown as WorkItemRow[];
  return rows.flatMap((row) => {
    const scope = briefScopeOf(row.meta);
    if (!scope) return [];
    return [{ ...row, work_item_tasks: [], brief_scope: scope }];
  });
}

export function useBriefs(profileId: string | undefined) {
  return useQuery({
    queryKey: ["briefs", profileId],
    queryFn: () => fetchBriefs(profileId as string),
    enabled: Boolean(profileId),
  });
}

/** An item briefs exactly one scope. Passing null clears both keys. */
export async function setBriefRole(workItemId: string, scope: BriefScope | null): Promise<void> {
  const { data, error: readError } = await supabase
    .from("work_items")
    .select("meta")
    .eq("id", workItemId)
    .maybeSingle();
  if (readError) throw readError;

  const meta = { ...((data?.meta ?? {}) as Record<string, unknown>) };
  if (scope) {
    meta["role"] = "brief";
    meta["brief_scope"] = scope;
  } else {
    delete meta["role"];
    delete meta["brief_scope"];
  }

  const { error } = await supabase.from("work_items").update({ meta }).eq("id", workItemId);
  if (error) throw error;
}

export function useInvalidateBriefs() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["briefs"] }),
      queryClient.invalidateQueries({ queryKey: ["work-items"] }),
    ]);
  };
}
