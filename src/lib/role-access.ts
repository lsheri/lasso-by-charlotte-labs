/**
 * One definition of what a role may see. The sidebar and the mobile tab bar
 * both read these, so a rule can never drift between the two surfaces.
 */
import { isBusinessOrg } from "@/hooks/use-profile";

export type RoleProfile = { role: string; org_type: string } | null | undefined;

export function isCoach(profile: RoleProfile): boolean {
  return profile?.role === "coach";
}

/**
 * S4 — which nav shell a person gets, and nothing else.
 *
 * A guest account has no work and no engagements of its own, so the worker
 * nav would be mostly dead ends. This says nothing about which coaching
 * surfaces anyone may reach: reach is decided from engagement membership in
 * src/lib/coaching-reach.ts, and a guest with no Review grant reaches none.
 */
export function usesGuestNav(profile: RoleProfile): boolean {
  return isCoach(profile);
}


export function canManageMembers(profile: RoleProfile): boolean {
  return profile?.role === "admin" || profile?.role === "lead";
}

/** The firm view aggregates a roster, so a solo workspace never sees it. */
export function canSeeFirmView(profile: RoleProfile): boolean {
  return canManageMembers(profile) && isBusinessOrg(profile);
}

/**
 * PASS A1 — who has a coach by arrangement rather than by invitation.
 *
 * In a firm or a school the reporting line is part of the place, so these
 * roles always get the coach group. A solo workspace has no such line: the
 * group appears only once a real link exists, which the caller supplies.
 */
const COACHED_ROLES = ["em", "lead", "admin"];

export function hasCoachByArrangement(profile: RoleProfile): boolean {
  if (!profile || isCoach(profile)) return false;
  if (profile.org_type === "personal") return false;
  return COACHED_ROLES.includes(profile.role);
}

/** A solo workspace has no roster to administer, only the coaches it invited. */
export function membersLabel(profile: RoleProfile): string {
  return isBusinessOrg(profile) ? "Members" : "Your coaches";
}
