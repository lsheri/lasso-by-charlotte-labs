import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * The signed in person's own member_role on one engagement, read from
 * engagement_members. This is a read, not a gate: each surface decides for
 * itself what a role means there, the same relationship the policies check.
 * A null result means the person is not on that engagement at all.
 */
export function useMyMemberRole(
  engagementId: string | null | undefined,
  profileId: string | undefined,
) {
  return useQuery({
    queryKey: ["my-member-role", engagementId ?? null, profileId ?? null],
    enabled: Boolean(engagementId && profileId),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("engagement_members")
        .select("member_role")
        .eq("engagement_id", engagementId as string)
        .eq("profile_id", profileId as string)
        .maybeSingle();
      if (error) throw error;
      return (data?.member_role as string | undefined) ?? null;
    },
  });
}
