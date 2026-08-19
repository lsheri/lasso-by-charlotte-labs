export type InviteEmailResult = {
  sent: boolean;
  /** "not_configured" means the copy-the-link fallback should be shown. */
  reason: "sent" | "not_configured" | "failed";
  message: string | null;
};

/**
 * Runtime whitelist for the content free invite.blocked record. "not_permitted"
 * covers a refused mint: someone without admin rights asked for a link.
 */
export const INVITE_BLOCKED_STATES = [
  "mismatch",
  "expired",
  "revoked",
  "used",
  "already_member",
  "not_permitted",
] as const;

export type InviteBlockedState = (typeof INVITE_BLOCKED_STATES)[number];

/** Shown where an invite control used to be, for anyone who is not an admin. */
export const INVITE_ADMIN_ONLY_LINE =
  "Invites are managed by your workspace admin. You can share your engagements with existing coaches here.";

/** Shown on a pending invite row for a lead, who can copy and withdraw only. */
export const INVITE_RESEND_ADMIN_ONLY_LINE = "Only an admin can issue a new link.";

/** Refusals are typed so the dialog never has to read a database message. */
export type CreateInviteResult =
  | { ok: true; code: string }
  | { ok: false; reason: "not_permitted"; message: string };
