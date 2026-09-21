import { useQuery } from "@tanstack/react-query";

import type { Profile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { sharedWithMe, type SharedGroup, type SharedMembershipRow } from "@/lib/shared-with-me";

type RawRow = {
  engagement_id: string;
  profile_id: string;
  member_role: string | null;
  added_by: string | null;
};

/**
 * The boards another person handed the signed in person, grouped by who
 * handed them over.
 *
 * The filter to this person's own profiles lives in the query, not only in the
 * rule below. A member of a board may read that board's whole member list, so
 * asking narrowly is what keeps this a list of what was given to you rather
 * than a directory of everyone else on the board.
 */
export function useSharedWithMe(profiles: Profile[]) {
  const profileIds = profiles.map((profile) => profile.id);
  const csv = profileIds.join(",");

  const query = useQuery({
    queryKey: ["shared-with-me", csv],
    enabled: profileIds.length > 0,
    queryFn: async (): Promise<SharedGroup[]> => {
      const { data, error } = await supabase
        .from("engagement_members")
        .select("engagement_id, profile_id, member_role, added_by")
        .in("profile_id", profileIds);
      if (error) throw error;

      const rows = (data ?? []) as unknown as RawRow[];
      const granterIds = Array.from(
        new Set(
          rows.flatMap((row) =>
            row.added_by && !profileIds.includes(row.added_by) ? [row.added_by] : [],
          ),
        ),
      );
      const engagementIds = Array.from(new Set(rows.map((row) => row.engagement_id)));
      if (granterIds.length === 0 || engagementIds.length === 0) return [];

      const [people, boards] = await Promise.all([
        supabase.from("profiles").select("id, display_name").in("id", granterIds),
        supabase.from("engagements").select("id, title, code").in("id", engagementIds),
      ]);
      if (people.error) throw people.error;
      if (boards.error) throw boards.error;

      const nameById = new Map(
        (people.data ?? []).map((row) => [row.id as string, row.display_name as string]),
      );
      const boardById = new Map(
        (boards.data ?? []).map((row) => [
          row.id as string,
          { title: (row.title as string) ?? "", code: (row.code as string | null) ?? null },
        ]),
      );

      const joined: SharedMembershipRow[] = rows.flatMap((row) => {
        const board = boardById.get(row.engagement_id);
        const name = row.added_by ? nameById.get(row.added_by) : undefined;
        // No board row or no recorded person means there is nothing this list
        // can honestly say, so the membership simply is not in it.
        if (!board || !name) return [];
        return [
          {
            engagement_id: row.engagement_id,
            profile_id: row.profile_id,
            member_role: row.member_role,
            added_by: row.added_by,
            engagement_title: board.title,
            engagement_code: board.code,
            granter_name: name,
          },
        ];
      });

      return sharedWithMe(profileIds, joined);
    },
  });

  return {
    groups: query.data ?? [],
    isLoading: profileIds.length > 0 && query.isLoading,
    error: (query.error ?? null) as Error | null,
  };
}
