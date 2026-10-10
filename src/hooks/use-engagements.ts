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
  shared_by_id: string | null;
  clients: {
    id: string;
    name: string;
    quick_folder: boolean;
    kind?: "client" | "folder";
    parent_id?: string | null;
  } | null;
};

/**
 * The one engagement query. Every caller reads through this and splits live
 * from archived afterwards, so the select never drifts between surfaces.
 */
export async function fetchAllMyEngagements(profileId: string): Promise<EngagementSummary[]> {
  const { data, error } = await supabase
    .from("engagement_members")
    .select(
      `added_by, engagements(id, code, title, client_label, brief, term_label, archived_at, ${CLIENT_JOIN})`,
    )
    .eq("profile_id", profileId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { added_by: string | null; engagements: Omit<EngagementSummary, "shared_by_id"> | null }[];
  return rows
    .map((r) => r.engagements ? {
      ...r.engagements,
      shared_by_id: r.added_by && r.added_by !== profileId ? r.added_by : null,
    } : null)
    .filter((e): e is EngagementSummary => e !== null)
    // A folder engagement carries no code, so the sort must never assume one.
    .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
}

export async function fetchMyEngagements(profileId: string): Promise<EngagementSummary[]> {
  return (await fetchAllMyEngagements(profileId)).filter((e) => !e.archived_at);
}

export async function fetchMyArchivedEngagements(profileId: string): Promise<EngagementSummary[]> {
  return (await fetchAllMyEngagements(profileId)).filter((e) => Boolean(e.archived_at));
}

export function useEngagements(profileId: string | undefined) {
  return useQuery({
    queryKey: ["engagements", profileId],
    queryFn: () => fetchMyEngagements(profileId as string),
    enabled: Boolean(profileId),
  });
}

/** Keyed under ["engagements"] so useInvalidateClients refreshes it too. */
export function useArchivedEngagements(profileId: string | undefined) {
  return useQuery({
    queryKey: ["engagements", "archived", profileId],
    queryFn: () => fetchMyArchivedEngagements(profileId as string),
    enabled: Boolean(profileId),
  });
}
