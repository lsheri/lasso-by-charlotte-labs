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
  "Invites are managed by your workspace admin. You can share your workboards with existing coaches here.";

/** Shown on a pending invite row for a lead, who can copy and withdraw only. */
export const INVITE_RESEND_ADMIN_ONLY_LINE = "Only an admin can issue a new link.";

/** Refusals are typed so the dialog never has to read a database message. */
export type CreateInviteResult =
  | { ok: true; code: string }
  | { ok: false; reason: "not_permitted"; message: string };

/** Which of the three invitation letters a given invite deserves. */
export type InviteVariant = "coach_personal" | "coach_business" | "standard";

export function inviteEmailVariant(
  role?: string | null | undefined,
  orgType?: "personal" | "business" | null | undefined,
): InviteVariant {
  if (role !== "coach") return "standard";
  return orgType === "business" ? "coach_business" : "coach_personal";
}

/** Published Resend template alias for each invitation letter. */
export const INVITE_TEMPLATE_ALIAS: Record<InviteVariant, string> = {
  standard: "invite-member",
  coach_personal: "invite-coach-personal",
  coach_business: "invite-coach-firm",
};

/** "a", "a and b", "a, b and c". Empty list gives an empty string. */
export function joinNames(names: readonly string[]): string {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0] as string;
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1] as string}`;
}

/** Whole sentence for the business coach letter, or null to let the template fall back. */
export function coachScopeLine(subjectNames: readonly string[] | undefined): string | null {
  const names = joinNames(subjectNames ?? []);
  if (!names) return null;
  return `You will see the work of the people you were added to: ${names}. Nothing else in the workspace is visible to you.`;
}
