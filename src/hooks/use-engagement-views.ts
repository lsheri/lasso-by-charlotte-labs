import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";

/**
 * A person's own record of when they last opened each engagement board.
 *
 * This is product state, like a recents list, so it is written straight to the
 * person's own rows. Nobody else can read them.
 */

export type EngagementViewRow = { engagement_id: string; last_viewed_at: string };

export async function fetchEngagementViews(profileId: string): Promise<EngagementViewRow[]> {
  const { data, error } = await supabase
    .from("engagement_views")
    .select("engagement_id, last_viewed_at")
    .eq("profile_id", profileId)
    .order("last_viewed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EngagementViewRow[];
}

export function useEngagementViews(profileId: string | undefined) {
  return useQuery({
    queryKey: ["engagement-views", profileId],
    queryFn: () => fetchEngagementViews(profileId as string),
    enabled: Boolean(profileId),
  });
}

/** One row per person per engagement, overwritten on each open. */
export async function recordEngagementView(
  profileId: string,
  engagementId: string,
): Promise<void> {
  const { error } = await supabase.from("engagement_views").upsert(
    {
      profile_id: profileId,
      engagement_id: engagementId,
      last_viewed_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,engagement_id" },
  );
  if (error) throw error;
}

/**
 * Writes the view once per board open. The guard is keyed by person and
 * engagement, so a re-render, a pan or a zoom never writes again, and nothing
 * is written at all when the person cannot be identified.
 */
export function useRecordEngagementView(engagementId: string | undefined): void {
  const { data: profile } = useProfile();
  const written = useRef<string | null>(null);
  const profileId = profile?.id;

  useEffect(() => {
    if (!profileId || !engagementId) return;
    const key = `${profileId}:${engagementId}`;
    if (written.current === key) return;
    written.current = key;
    void recordEngagementView(profileId, engagementId).catch(() => {
      /* a recents row must never interrupt opening a board */
    });
  }, [profileId, engagementId]);
}
