/**
 * Pure invite-state logic, shared by the accept route and the server function.
 * Kept free of Supabase so it can be unit tested directly.
 */

export type InviteStatus = "ok" | "revoked" | "used" | "expired" | "not_found";

export type InviteStateRow = {
  revoked_at: string | null;
  used_at: string | null;
  expires_at: string;
};

/**
 * Precedence is deliberate: revoked beats used beats expired. A withdrawn
 * invite should say it was withdrawn even if it later passed its expiry.
 */
export function resolveInviteStatus(
  row: InviteStateRow,
  now: Date = new Date(),
): Exclude<InviteStatus, "not_found"> {
  if (row.revoked_at) return "revoked";
  if (row.used_at) return "used";
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  return "ok";
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** The RPC compares lowercased addresses, so the UI must compare the same way. */
export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeEmail(a);
  const right = normalizeEmail(b);
  return left.length > 0 && left === right;
}

/** "alex@firm.com" becomes "a•••@firm.com". Enough to recognise, not to harvest. */
export function maskEmail(email: string | null | undefined): string | null {
  const value = normalizeEmail(email);
  const at = value.indexOf("@");
  if (at < 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  return `${local[0]}•••@${domain}`;
}

export type InviteState = {
  status: InviteStatus;
  invited_role: string | null;
  org_name: string | null;
  is_email_bound: boolean;
  /** Full address only for the person it is bound to. Null otherwise. */
  email: string | null;
  /** Masked form, safe for an anonymous link holder. */
  email_hint: string | null;
  /** True when the viewer's own profile issued this invite. */
  created_by_you: boolean;
  expires_at: string | null;
  engagement_title: string | null;
  viewer: { signed_in: boolean; is_member: boolean; email_matches: boolean };
};

/** Malformed and unknown codes return the exact same shape, deliberately. */
export function notFoundState(signedIn: boolean): InviteState {
  return {
    status: "not_found",
    invited_role: null,
    org_name: null,
    is_email_bound: false,
    email: null,
    email_hint: null,
    created_by_you: false,
    expires_at: null,
    engagement_title: null,
    viewer: { signed_in: signedIn, is_member: false, email_matches: false },
  };
}

/** Which blocked state, if any, the accept route should record and render. */
export type BlockedState = "mismatch" | "expired" | "revoked" | "used" | "already_member";

export function blockedStateFor(state: InviteState, viewerEmail: string | null): BlockedState | null {
  if (state.status === "revoked") return "revoked";
  if (state.status === "used") return "used";
  if (state.status === "expired") return "expired";
  if (state.status === "not_found") return null;
  if (!state.viewer.signed_in) return null;
  if (state.viewer.is_member) return "already_member";
  // email_matches is decided server-side against the verified claim, so the
  // card is right even when the bound address is withheld from this viewer.
  if (state.is_email_bound && !state.viewer.email_matches) return "mismatch";
  return null;
}

/** The three messages join_org_with_invite raises, mapped to the same cards. */
export function blockedStateFromRpcError(message: string): BlockedState | null {
  const text = message.toLowerCase();
  if (text.includes("already a member")) return "already_member";
  if (text.includes("different email")) return "mismatch";
  if (text.includes("invalid or expired")) return "expired";
  return null;
}
