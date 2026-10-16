import type { OrgType } from "@/lib/org-type";

/**
 * B1: the ONE place that says what a workspace type means. Every predicate here
 * reproduces today's behaviour exactly, so pointing a call site at it changes
 * nothing on day one. When capabilities move onto the orgs row (plan C1), only
 * this file changes.
 */
export type TypeLike = OrgType | string | null | undefined;

/** Business workspaces: company and partner. Individual is everything else. */
export function isBusinessType(type: TypeLike): boolean {
  return type === "company" || type === "partner";
}

/** Has a roster to administer (members console, admin role on invites). Today: business. */
export function hasRoster(type: TypeLike): boolean {
  return isBusinessType(type);
}

/** Firm-wide roll-up. Company only: a partner holds another firm's people. */
export function hasFirmView(type: TypeLike): boolean {
  return type === "company";
}

/** The admin role is offered on invites. Today: business. */
export function showsAdminRole(type: TypeLike): boolean {
  return isBusinessType(type);
}

/** Partner-only surfaces (workshop keys, From your people). */
export function isPartnerType(type: TypeLike): boolean {
  return type === "partner";
}

/** A reporting line exists by arrangement (coach group without an invite). Today: anything but personal. */
export function hasCoachByArrangementType(type: TypeLike): boolean {
  return type !== "personal" && type != null;
}
