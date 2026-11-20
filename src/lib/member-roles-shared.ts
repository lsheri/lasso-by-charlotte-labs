/**
 * 20 Nov 2026, chat pill build Phase 2: who can be invited as what, and who may change a teammate's role. Liam decided
 * a proposal's Lead is a teammate with a login (D-97), so Lead comes back as a role in company workspaces. Pure: the
 * invite dialog, the Members page and the server all run these same rules; the server runs them again on every call.
 *
 * The four roles and their words: Admin, Lead, Member (stored as `em`), Coach.
 */

export const MEMBER_ROLES = ["admin", "lead", "em", "coach"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = { admin: "Admin", lead: "Lead", em: "Member", coach: "Coach" };

export function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && (MEMBER_ROLES as readonly string[]).includes(value);
}

/** What a workspace offers: Lead only where proposals live (company workspaces), Admin only in business workspaces. */
export type RoleWorkspace = { firmView: boolean; showsAdmin: boolean };

/** The roles an admin may invite someone as, in the order the dialog shows them. */
export function invitableRoles(workspace: RoleWorkspace): MemberRole[] {
  return MEMBER_ROLES.filter((role) => (role !== "lead" || workspace.firmView) && (role !== "admin" || workspace.showsAdmin)).sort(
    (a, b) => INVITE_ORDER.indexOf(a) - INVITE_ORDER.indexOf(b),
  );
}
const INVITE_ORDER: MemberRole[] = ["em", "lead", "admin", "coach"];

/**
 * A role change only moves between Admin, Lead and Member. A coach sees only what is shared with them and holds no
 * seat, so a coach is invited as a coach and a teammate is never quietly turned into one.
 */
export const CHANGEABLE_ROLES: readonly MemberRole[] = ["admin", "lead", "em"];

export type RoleChangeRefusal =
  | "not_admin"
  | "self"
  | "not_found"
  | "inactive"
  | "guest"
  | "coach"
  | "role"
  | "lead_needs_firm"
  | "same"
  | "last_admin";

export type RoleChangeCase = {
  caller: { profileId: string; orgId: string; role: string; active: boolean };
  target: { id: string; orgId: string; role: string; active: boolean; isGuest: boolean } | null;
  next: unknown;
  workspace: RoleWorkspace;
  /** Active, non-guest admins in the workspace now, the target included. */
  activeAdmins: number;
};

/** Null when the change may go ahead; otherwise why not. Checked in this order so the reason is the first that applies. */
export function roleChangeRefusal(c: RoleChangeCase): RoleChangeRefusal | null {
  if (c.caller.role !== "admin" || !c.caller.active) return "not_admin";
  if (!c.target || c.target.orgId !== c.caller.orgId) return "not_found";
  if (c.target.id === c.caller.profileId) return "self";
  if (!c.target.active) return "inactive";
  if (c.target.isGuest) return "guest";
  if (c.target.role === "coach" || c.next === "coach") return "coach";
  if (!isMemberRole(c.next) || !CHANGEABLE_ROLES.includes(c.next) || !isMemberRole(c.target.role)) return "role";
  if (c.next === "lead" && !c.workspace.firmView) return "lead_needs_firm";
  if (c.next === c.target.role) return "same";
  if (c.target.role === "admin" && c.activeAdmins <= 1) return "last_admin";
  return null;
}

export type RoleChangeInput = { profile_id?: string | null | undefined; member_id: string; role: string };
export type RoleChangeResult = { ok: true; role: MemberRole } | { ok: false; reason: RoleChangeRefusal | "unavailable" };

export const ROLE_COPY = {
  change: "Change role",
  changeLabel: (name: string) => `Change the role for ${name}`,
  dialogTitle: (name: string) => `Change ${name}'s role`,
  save: "Save role",
  saving: "Saving",
  cancel: "Cancel",
  done: (name: string, role: MemberRole) => `${name} is now ${role === "admin" ? "an" : "a"} ${MEMBER_ROLE_LABELS[role]}.`,
  hints: {
    admin: "Manages people, invites, clients and settings, alongside their own work.",
    lead: "Runs proposals: sees every proposal and its fees, and manages the people the firm works with.",
    em: "Builds their own record in this workspace. Sees only their own work.",
    coach: "Reviews the work you choose to share with them. Cannot see anything you have not shared.",
  } satisfies Record<MemberRole, string>,
  refusals: {
    not_admin: "Only an admin can change roles.",
    self: "You cannot change your own role. Ask another admin.",
    not_found: "That person is not in this workspace. Reload the page.",
    inactive: "Reactivate them first, then change their role.",
    guest: "A guest has no role here to change.",
    coach: "Coaches are invited as coaches. Invite them again with the role they need.",
    role: "That role cannot be given here.",
    lead_needs_firm: "Lead is for company workspaces, where proposals live.",
    same: "They already have that role.",
    last_admin: "This is the last admin. Make someone else an admin first.",
    unavailable: "That did not go through. Nothing was changed. Try again in a moment.",
  } satisfies Record<RoleChangeRefusal | "unavailable", string>,
} as const;
