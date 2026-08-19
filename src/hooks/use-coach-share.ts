import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useEngagementSlice } from "@/hooks/use-engagement-page";

export type { EngagementCoach } from "@/lib/engagement-page-shared";
import type { EngagementCoach } from "@/lib/engagement-page-shared";

export function engagementCoachesKey(engagementId: string) {
  return ["engagement-coaches", engagementId] as const;
}

/** Coaches this engagement is shared with, with when and by whom where known. */
export function useEngagementCoaches(engagementId: string) {
  // Passthrough: the rows come from the consolidated engagement payload, and
  // this key stays subscribed so every existing invalidation still refreshes it.
  return useEngagementSlice<EngagementCoach[]>(
    engagementId,
    engagementCoachesKey(engagementId),
    (payload) => payload.coaches,
  );
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
