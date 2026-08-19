export type MemberRow = {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  created_at: string;
  deactivated_at: string | null;
};

export type InviteRow = {
  id: string;
  code: string;
  invited_role: string;
  email: string | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_by_name: string | null;
};

export type EntitlementSummary = {
  plan: string;
  source: string;
  status: string;
  seats: number | null;
  seats_used: number;
  guest_seats_counted: boolean;
  ends_at: string | null;
  coaches: number;
};

export type MembersPayload = {
  viewer_role: string;
  members: MemberRow[];
  invites: InviteRow[];
  /** Null when the workspace has no plan on file. Display only, never enforced. */
  entitlement: EntitlementSummary | null;
};

const SOURCE_WORD: Record<string, string> = {
  comped: "comped",
  trial: "on trial",
  paid: "paid",
};

/** "Internal plan, comped". Never dresses a comped plan up as a paid one. */
export function planLine(entitlement: EntitlementSummary): string {
  const plan = entitlement.plan
    ? `${entitlement.plan.charAt(0).toUpperCase()}${entitlement.plan.slice(1)} plan`
    : "Plan";
  const source = SOURCE_WORD[entitlement.source] ?? entitlement.source;
  return `${plan}, ${source}`;
}

export function seatsLine(entitlement: EntitlementSummary): string {
  const total = entitlement.seats;
  const used = entitlement.seats_used;
  const base = total === null ? `${used} in use` : `${used} of ${total} seats in use`;
  if (entitlement.guest_seats_counted) return base;
  return entitlement.coaches > 0
    ? `${base}. Coaches do not use a seat.`
    : `${base}. Coaches never use a seat.`;
}

/** "a1b2c3d4e5f6" → "a1b2…e5f6", enough to recognise, not enough to reuse. */
export function maskCode(code: string): string {
  if (code.length <= 8) return code;
  return `${code.slice(0, 4)}…${code.slice(-4)}`;
}

/**
 * Compose time duplicate check. It only ever runs over the admin gated member
 * list the viewer can already read, so it can never answer "does this account
 * exist" for anyone else. A non admin viewer passes an empty list and the
 * check quietly returns nothing.
 */
export function findMemberByEmail(members: MemberRow[], email: string): MemberRow | null {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return null;
  return members.find((row) => (row.email ?? "").trim().toLowerCase() === wanted) ?? null;
}

/** The match only turns into a "share instead" offer for an active coach. */
export function coachToShareWithInstead(members: MemberRow[], email: string): MemberRow | null {
  const match = findMemberByEmail(members, email);
  if (!match) return null;
  if (match.role !== "coach") return null;
  if (match.deactivated_at) return null;
  return match;
}
