import { useAffiliation } from "@/hooks/use-affiliation";
import { useHasLiveCoachLink } from "@/hooks/use-coaching-links";
import { useCoachingReach } from "@/hooks/use-coaching-reach";
import { usePartnerSharedBoards } from "@/hooks/use-partner-shared-boards";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { vocabFor } from "@/lib/edu-vocab";
import * as roles from "@/lib/role-access";
import { clientsEnabled } from "@/lib/workspace-settings";
import type { NavCtx } from "./nav-config";

/** The same acting-workspace context for desktop and phone navigation. */
export function useNavCtx() {
  const { data: profile, profiles } = useProfile();
  const { data: affiliation } = useAffiliation();
  const institution = affiliation?.institution ?? null;
  const guestNav = roles.usesGuestNav(profile);
  const reach = useCoachingReach(profiles);
  const soloHasCoach = useHasLiveCoachLink(
    !guestNav && profile?.org_type === "personal" && Boolean(profile?.id),
  );
  // MN-3b: the same work-items read the sidebar already shares; no new query.
  const { data: work } = useWorkItems();
  const { data: partnerShared } = usePartnerSharedBoards();
  const vocab = vocabFor(profile);
  const ctx: NavCtx = {
    type: profile?.org_type ?? "personal",
    role: profile?.role ?? "",
    canReview: reach.canReach,
    canManageMembers: roles.canManageMembers(profile),
    canSeeFirmView: roles.canSeeFirmView(profile),
    hasCoachLink: soloHasCoach,
    affiliated: Boolean(institution),
    clientsEnabled: clientsEnabled(profile),
    ...(work ? { workItemCount: work.items.length } : {}),
    ...(partnerShared ? { partnerShareCount: partnerShared.length } : {}),
  };
  return { ctx, profile, profiles, institution, vocab, guestNav,
    labels: { vocab, institutionName: institution?.name ?? null } };
}