import { useAffiliation } from "@/hooks/use-affiliation";
import { useHasLiveCoachLink } from "@/hooks/use-coaching-links";
import { useCoachingReach } from "@/hooks/use-coaching-reach";
import { useProfile } from "@/hooks/use-profile";
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
  };
  return { ctx, profile, profiles, institution, vocab, guestNav,
    labels: { vocab, institutionName: institution?.name ?? null } };
}