import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type EngagementSummary = {
  id: string;
  code: string;
  title: string;
  client_label: string | null;
  brief: string | null;
  term_label: string | null;
  clients: { id: string; name: string; quick_folder: boolean } | null;
};

export async function fetchMyEngagements(profileId: string): Promise<EngagementSummary[]> {
  const { data, error } = await supabase
    .from("engagement_members")
    .select(
      "engagements(id, code, title, client_label, brief, term_label, clients(id, name, quick_folder))",
    )
    .eq("profile_id", profileId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { engagements: EngagementSummary | null }[];
  return rows
    .map((r) => r.engagements)
    .filter((e): e is EngagementSummary => e !== null)
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function useEngagements(profileId: string | undefined) {
  return useQuery({
    queryKey: ["engagements", profileId],
    queryFn: () => fetchMyEngagements(profileId as string),
    enabled: Boolean(profileId),
  });
}
