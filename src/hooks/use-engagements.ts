import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { CLIENT_JOIN } from "@/lib/clients";

export type EngagementSummary = {
  id: string;
  code: string;
  title: string;
  client_label: string | null;
  brief: string | null;
  term_label: string | null;
  archived_at: string | null;
  clients: {
    id: string;
    name: string;
    quick_folder: boolean;
    kind?: "client" | "folder";
    parent_id?: string | null;
  } | null;
};

export async function fetchMyEngagements(profileId: string): Promise<EngagementSummary[]> {
  const { data, error } = await supabase
    .from("engagement_members")
    .select(
      `engagements(id, code, title, client_label, brief, term_label, archived_at, ${CLIENT_JOIN})`,
    )
    .eq("profile_id", profileId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { engagements: EngagementSummary | null }[];
  return rows
    .map((r) => r.engagements)
    .filter((e): e is EngagementSummary => e !== null)
    .filter((e) => e.archived_at === null)
    // A folder engagement carries no code, so the sort must never assume one.
    .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
}

export function useEngagements(profileId: string | undefined) {
  return useQuery({
    queryKey: ["engagements", profileId],
    queryFn: () => fetchMyEngagements(profileId as string),
    enabled: Boolean(profileId),
  });
}
