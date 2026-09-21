import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/use-profile";
import { canReachCoaching, reviewableEngagements, type ReachMembership } from "@/lib/coaching-reach";

type ReachRow = ReachMembership & { profile_id: string };

/**
 * What the signed in person may review, read from their own engagement
 * memberships across every profile they hold. A person may hold profiles in
 * several workspaces, so the reach spans all of them.
 *
 * This is the one place a coaching surface asks whether it may appear. The
 * workspace wide role is not consulted: a grant on one board is reach to that
 * board's coaching surface and to no other.
 */
export function useCoachingReach(profiles: Profile[]) {
  const profileIds = profiles.map((profile) => profile.id);
  const csv = profileIds.join(",");

  const query = useQuery({
    queryKey: ["my-coach-memberships", csv],
    enabled: profileIds.length > 0,
    queryFn: async (): Promise<ReachRow[]> => {
      const { data, error } = await supabase
        .from("engagement_members")
        .select("engagement_id, profile_id, member_role")
        .in("profile_id", profileIds);
      if (error) throw error;
      return (data ?? []) as unknown as ReachRow[];
    },
  });

  const rows = query.data ?? [];
  const reviewRows = rows.filter((row) => reviewableEngagements([row]).length > 0);

  return {
    /** The engagements this person may review. */
    engagementIds: reviewableEngagements(rows),
    /** The profiles that carry at least one Review grant. */
    profileIds: Array.from(new Set(reviewRows.map((row) => row.profile_id))),
    canReach: canReachCoaching(rows),
    isLoading: profileIds.length > 0 && query.isLoading,
    isSuccess: profileIds.length === 0 || query.isSuccess,
    error: (query.error ?? null) as Error | null,
  };
}
