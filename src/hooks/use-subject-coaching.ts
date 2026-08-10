import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type SubjectNote = {
  id: string;
  created_at: string;
  did_well: string;
  would_try: string;
  watch_next: string;
  profiles: { display_name: string } | null;
};

export async function fetchNotesAboutMe(
  subjectId: string,
  engagementId: string,
): Promise<SubjectNote[]> {
  const { data, error } = await supabase
    .from("coaching_notes")
    .select("id, created_at, did_well, would_try, watch_next, profiles!coaching_notes_author_id_fkey(display_name)")
    .eq("subject_id", subjectId)
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SubjectNote[];
}

export function useNotesAboutMe(subjectId: string | undefined, engagementId: string) {
  return useQuery({
    queryKey: ["notes-about-me", subjectId, engagementId],
    queryFn: () => fetchNotesAboutMe(subjectId as string, engagementId),
    enabled: Boolean(subjectId),
  });
}

export type SubjectQuery = {
  id: string;
  question: string;
  created_at: string;
  profiles: { display_name: string } | null;
};

export async function fetchQueriesAboutMe(subjectId: string): Promise<SubjectQuery[]> {
  const { data, error } = await supabase
    .from("query_log")
    .select("id, question, created_at, profiles!query_log_asker_id_fkey(display_name)")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as SubjectQuery[];
}

export function useQueriesAboutMe(subjectId: string | undefined) {
  return useQuery({
    queryKey: ["queries-about-me", subjectId],
    queryFn: () => fetchQueriesAboutMe(subjectId as string),
    enabled: Boolean(subjectId),
  });
}
