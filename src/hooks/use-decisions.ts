import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
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
  return useQuery({
    queryKey: ["decisions", "engagement", engagementId],
    enabled: Boolean(engagementId),
    queryFn: async (): Promise<DecisionRow[]> => {
      const { data, error } = await supabase
        .from("decisions")
        .select("*")
        .eq("engagement_id", engagementId as string)
        .in("status", ["draft", "confirmed"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function srcsOf(row: DecisionRow): DecisionSrc[] {
  return Array.isArray(row.srcs) ? (row.srcs as unknown as DecisionSrc[]) : [];
}
