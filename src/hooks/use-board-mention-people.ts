import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MentionCandidate } from "@/lib/mention-editor";

export async function readBoardMentionPeople(engagementId: string, viewerProfileId: string): Promise<MentionCandidate[]> {
  const { data, error } = await supabase.rpc("board_people", { p_engagement: engagementId });
  if (error) throw error;
  return (data ?? []).filter((person) => person.profile_id !== viewerProfileId && person.display_name?.trim())
    .map((person) => ({ profileId: person.profile_id, displayName: person.display_name.trim() }));
}

export function useBoardMentionPeople(engagementId: string, viewerProfileId: string | undefined) {
  const query = useQuery({
    queryKey: ["board-mention-people", engagementId, viewerProfileId],
    enabled: Boolean(engagementId && viewerProfileId),
    queryFn: () => readBoardMentionPeople(engagementId, viewerProfileId ?? ""),
  });
  // Undefined until loaded, so callers can tell "not yet known" from "nobody".
  return query.data;
}