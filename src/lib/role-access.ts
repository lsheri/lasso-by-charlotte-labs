/**
 * One definition of what a role may see. The sidebar and the mobile tab bar
 * both read these, so a rule can never drift between the two surfaces.
 */
import { isBusinessOrg } from "@/hooks/use-profile";

export type RoleProfile = { role: string; org_type: string } | null | undefined;

export function isCoach(profile: RoleProfile): boolean {
  return profile?.role === "coach";
}

export function canManageMembers(profile: RoleProfile): boolean {
  return profile?.role === "admin" || profile?.role === "lead";
}

/** The firm view aggregates a roster, so a solo workspace never sees it. */
export function canSeeFirmView(profile: RoleProfile): boolean {
  return canManageMembers(profile) && isBusinessOrg(profile);
}

/** A solo workspace has no roster to administer, only the coaches it invited. */
export function membersLabel(profile: RoleProfile): string {
  return isBusinessOrg(profile) ? "Members" : "Your coaches";
}
