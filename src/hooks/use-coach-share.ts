import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { ShareResult } from "@/lib/coach-share-shared";
import { logEvent } from "@/lib/telemetry";

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

export type CoachOption = { id: string; display_name: string };

export function orgCoachesKey(orgId: string) {
  return ["org-coaches", orgId] as const;
}

/** Active coaches in this workspace, the people an engagement can be shared with. */
export function useOrgCoaches(orgId: string | undefined) {
  return useQuery({
    queryKey: orgCoachesKey(orgId ?? ""),
    enabled: Boolean(orgId),
    queryFn: async (): Promise<CoachOption[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("org_id", orgId as string)
        .eq("role", "coach")
        .is("deactivated_at", null)
        .order("display_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * One place that calls the two share RPCs, so every surface grants exactly
 * what a single share grants. Sharing with several coaches is a plain loop
 * over the same call, and each result is kept so nothing is reported as done
 * when it was refused.
 */
export function useEngagementShareActions(engagementId: string, orgId: string) {
  const invalidateShares = useShareInvalidation();
  const [busy, setBusy] = useState<"one" | "all" | null>(null);

  const call = useCallback(
    async (coach: CoachOption, action: "shared" | "unshared"): Promise<ShareResult> => {
      const { error } =
        action === "shared"
          ? await supabase.rpc("share_engagement_with_coach", {
              p_engagement: engagementId,
              p_coach_profile: coach.id,
            })
          : await supabase.rpc("unshare_engagement_coach", {
              p_engagement: engagementId,
              p_coach_profile: coach.id,
            });
      if (error) return { id: coach.id, label: coach.display_name, ok: false, message: error.message };
      logEvent("coach.engagement_shared", orgId, { action });
      return { id: coach.id, label: coach.display_name, ok: true };
    },
    [engagementId, orgId],
  );

  const runOne = useCallback(
    async (coach: CoachOption, action: "shared" | "unshared") => {
      setBusy("one");
      const result = await call(coach, action);
      await invalidateShares();
      setBusy(null);
      return result;
    },
    [call, invalidateShares],
  );

  const runMany = useCallback(
    async (coaches: CoachOption[]) => {
      setBusy("all");
      const results: ShareResult[] = [];
      for (const coach of coaches) results.push(await call(coach, "shared"));
      await invalidateShares();
      setBusy(null);
      return results;
    },
    [call, invalidateShares],
  );

  return { busy, runOne, runMany };
}