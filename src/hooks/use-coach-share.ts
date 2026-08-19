import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { supabase } from "@/integrations/supabase/client";

export type EngagementCoach = {
  id: string;
  display_name: string;
  added_at: string | null;
  added_by_name: string | null;
};

export function engagementCoachesKey(engagementId: string) {
  return ["engagement-coaches", engagementId] as const;
}

/** Coaches this engagement is shared with, with when and by whom where known. */
export function useEngagementCoaches(engagementId: string) {
  return useQuery({
    queryKey: engagementCoachesKey(engagementId),
    queryFn: async (): Promise<EngagementCoach[]> => {
      const { data, error } = await supabase
        .from("engagement_members")
        .select(
          "profile_id, member_role, added_at, profiles!engagement_members_profile_id_fkey(id, display_name), added_by_profile:profiles!engagement_members_added_by_fkey(display_name)",
        )
        .eq("engagement_id", engagementId)
        .eq("member_role", "coach");
      if (error) throw error;
      return ((data ?? []) as unknown as {
        added_at: string | null;
        profiles: { id: string; display_name: string } | null;
        added_by_profile: { display_name: string } | null;
      }[])
        .filter((row) => row.profiles !== null)
        .map((row) => ({
          id: row.profiles!.id,
          display_name: row.profiles!.display_name,
          added_at: row.added_at,
          added_by_name: row.added_by_profile?.display_name ?? null,
        }));
    },
  });
}

/**
 * Both share surfaces write the same rows, so both refresh the same readers:
 * the engagement section, the coach's own list, and the share dialog.
 */
export function useShareInvalidation() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["engagement-coaches"] }),
      queryClient.invalidateQueries({ queryKey: ["coach-subjects"] }),
      queryClient.invalidateQueries({ queryKey: ["coach-share"] }),
    ]);
  }, [queryClient]);
}