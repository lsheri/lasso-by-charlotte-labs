import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Whether the signed in person is on this engagement as a worker rather than a
 * coach. Editing and sharing affordances are gated on this, not on role, so an
 * admin who does not work here is never offered an action the policy refuses.
 */
export function useMyEngagementMembership(
  engagementId: string,
  profileId: string | undefined,
) {
  return useQuery({
    queryKey: ["engagement-membership", engagementId, profileId],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<{ isMember: boolean; isCoachMember: boolean }> => {
      const { data, error } = await supabase
        .from("engagement_members")
        .select("member_role")
        .eq("engagement_id", engagementId)
        .eq("profile_id", profileId as string);
      if (error) throw error;
      const rows = data ?? [];
      return {
        isMember: rows.some((row) => row.member_role !== "coach"),
        isCoachMember: rows.some((row) => row.member_role === "coach"),
      };
    },
  });
}
