/**
 * Joining Lasso needs an invite from an org admin. The rules live here as one
 * pure function so the auth page and the server function cannot disagree, and
 * so every refusal is a typed, honest line rather than a database message.
 */

export const SIGNUP_NO_INVITE_LINE =
  "Lasso is invite based right now. Ask your organization admin for an invite.";

export const SIGNUP_INVITE_LINES = {
  missing: SIGNUP_NO_INVITE_LINE,
  expired: "This invite has expired. Ask your organization admin for a fresh one.",
  revoked: "This invite was withdrawn. Ask your organization admin for a new one.",
  used: "This invite has already been accepted. Sign in with the account that used it.",
  mismatch: "This invite is for a different email address. Use the address it was sent to.",
} as const;

export type SignupInviteReason = keyof typeof SIGNUP_INVITE_LINES;

export type SignupInviteRow = {
  code: string;
  email: string | null;
  expires_at: string | null;
  used_at: string | null;
  revoked_at: string | null;
};

export type SignupInviteCheck =
  | { ok: true; code: string; email: string | null; org_name: string | null }
  | { ok: false; reason: SignupInviteReason; message: string };

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function refuse(reason: SignupInviteReason): SignupInviteCheck {
  return { ok: false, reason, message: SIGNUP_INVITE_LINES[reason] };
}

/**
 * `email` is optional: with no address this answers whether the code itself is
 * still good, which is what the sign up page needs before anyone has typed.
 */
export function evaluateSignupInvite(
  invite: SignupInviteRow | null,
  email: string | null,
  now: Date = new Date(),
  orgName: string | null = null,
): SignupInviteCheck {
  if (!invite || !invite.code) return refuse("missing");
  if (invite.revoked_at) return refuse("revoked");
  if (invite.used_at) return refuse("used");
  if (!invite.expires_at || new Date(invite.expires_at).getTime() <= now.getTime()) {
    return refuse("expired");
  }
  const bound = normalizeEmail(invite.email);
  const given = normalizeEmail(email);
  if (bound && given && bound !== given) return refuse("mismatch");
  return { ok: true, code: invite.code, email: invite.email, org_name: orgName };
}
