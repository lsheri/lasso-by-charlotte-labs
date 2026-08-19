import { useEngagementSlice } from "@/hooks/use-engagement-page";
import type { EngagementMembership } from "@/lib/engagement-page-shared";

/**
 * Whether the signed in person is on this engagement as a worker rather than a
 * coach. Editing and sharing affordances are gated on this, not on role, so an
 * admin who does not work here is never offered an action the policy refuses.
 * The rows come from the consolidated engagement payload, computed server side
 * from the caller's own membership read; this key stays subscribed so existing
 * invalidations keep working.
 */
export function useMyEngagementMembership(engagementId: string, profileId: string | undefined) {
  return useEngagementSlice<EngagementMembership>(
    engagementId,
    ["engagement-membership", engagementId, profileId],
    (payload) => payload.membership,
    { enabled: Boolean(profileId) },
  );
}
