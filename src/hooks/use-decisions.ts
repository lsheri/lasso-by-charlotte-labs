import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useEngagementSlice } from "@/hooks/use-engagement-page";
import type { Database } from "@/integrations/supabase/types";

export type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];
export type DecisionSrc = { work_item_id: string; turn_id?: string | null };

export async function fetchDecisions(): Promise<DecisionRow[]> {
  const { data, error } = await supabase
    .from("decisions")
    .select("*")
    .in("status", ["draft", "confirmed"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function useDecisions() {
  return useQuery({ queryKey: ["decisions"], queryFn: fetchDecisions });
}

export function useEngagementDecisions(engagementId: string | undefined) {
  // Passthrough onto the consolidated engagement payload; the key is unchanged
  // so ["decisions"] invalidations still refresh this list.
  return useEngagementSlice<DecisionRow[]>(
    engagementId,
    ["decisions", "engagement", engagementId],
    (payload) => payload.decisions,
  );
}

export function srcsOf(row: DecisionRow): DecisionSrc[] {
  return Array.isArray(row.srcs) ? (row.srcs as unknown as DecisionSrc[]) : [];
}

export type SourceItemInfo = { id: string; title: string; type: string };

/** Titles and types for the items a decision cites, so the card can say where it landed. */
export function useDecisionSourceItems(ids: string[]) {
  const key = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["decision-source-items", key],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, SourceItemInfo>> => {
      const { data, error } = await supabase
        .from("work_items")
        .select("id, title, type")
        .in("id", ids);
      if (error) throw error;
      const out: Record<string, SourceItemInfo> = {};
      for (const row of data ?? []) out[row.id] = row as SourceItemInfo;
      return out;
    },
  });
}
