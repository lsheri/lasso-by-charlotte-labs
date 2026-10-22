/** SH-5c/5d: client-safe pieces of board invites by email. */

export type BoardInviteLevel = "review" | "work";
export type BoardInviteConversations = "summaries" | "full";

/** Only a whole address counts; anything else stays a name search. */
export function looksLikeEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

export const LEVEL_FROM_LABEL = { Viewer: "review", Collaborator: "work" } as const;
export const CONVERSATIONS_FROM_LABEL = { Summaries: "summaries", "Full conversations": "full" } as const;

export const INVITE_COPY = {
  invite: (email: string) => `Invite ${email}`,
  sent: "Invite sent.",
  pending: "An admin needs to approve this first.",
  notEmailed: "Invite saved. The email did not send.",
  invitedHeading: "Invited",
  stateSent: "Invited",
  statePending: "Waiting for an admin",
  withdraw: "Withdraw",
} as const;

export function inviteResultLine(result: { status: string; emailed: boolean }): string {
  if (result.status === "pending_approval") return INVITE_COPY.pending;
  return result.emailed ? INVITE_COPY.sent : INVITE_COPY.notEmailed;
}

export type BoardInvitePreviewState =
  | "not_found"
  | "sent"
  | "pending_approval"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "expired";

export type BoardInvitePreview = {
  state: BoardInvitePreviewState;
  board: string | null;
  by: string | null;
  kind: string | null;
  email_hint: string | null;
  /** SH-5f: company name for member invites, null for peer. */
  org?: string | null;
};

export const ACCEPT_COPY = {
  heading: (by: string, board: string) => `${by} invited you to ${board}`,
  memberHeading: (by: string, org: string) => `${by} invited you to join ${org} on Lasso`,
  memberBoard: (board: string) => `You'll work on ${board}.`,
  useAddress: (hint: string) => `Use the address this was sent to: ${hint}.`,
  signIn: "Sign in",
  signUp: "Create an account",
  accept: "Accept",
  signOut: "Sign out",
  pending: "This invite is waiting for an admin to approve it.",
  accepted: "This invite was already accepted.",
  openBoard: "Open the board",
  closed: (by: string) => `This invite is no longer open. Ask ${by} for a new one.`,
  notFound: "This invite does not exist.",
  missing: "This invite does not exist.",
  loading: "One moment.",
} as const;

/** The exact place sign in and sign up return to. */
export function boardInviteReturnPath(code: string): string {
  return `/board-invite?${new URLSearchParams({ code }).toString()}`;
}

export function isBoardInvitePath(next: string | undefined): next is string {
  return typeof next === "string" && next.startsWith("/board-invite?");
}

/** AU-1: a masked address, never the full one. "jo@x.com" -> "j***@x.com". */
export function maskEmail(email: string | null | undefined): string | null {
  const v = (email ?? "").trim();
  const at = v.indexOf("@");
  if (at < 1) return null;
  return `${v[0]}***${v.slice(at)}`;
}

export const BOARD_SIGNUP_COPY = {
  mismatch: (hint: string) => `This invite was sent to ${hint}. Use that address.`,
} as const;

/** The code inside a /board-invite?code=... next path, or null. */
export function boardInviteCodeFrom(next: string | undefined): string | null {
  if (!isBoardInvitePath(next)) return null;
  return new URLSearchParams(next.split("?")[1] ?? "").get("code");
}

/** SHARE-3: most addresses one Send will take. */
export const INVITE_BATCH_CAP = 20;

/**
 * SHARE-3: split on commas, semicolons, whitespace and newlines; trim,
 * lowercase, dedupe in order. Whole addresses only; the rest are invalid.
 * Anything beyond the cap is returned separately and left in the field.
 */
export function parseEmailList(text: string, cap: number = INVITE_BATCH_CAP): {
  valid: string[];
  invalid: string[];
  overCap: string[];
} {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  const overCap: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const part = raw.trim().toLocaleLowerCase();
    if (!part || seen.has(part)) continue;
    seen.add(part);
    if (!looksLikeEmail(part)) invalid.push(part);
    else if (valid.length >= cap) overCap.push(part);
    else valid.push(part);
  }
  return { valid, invalid, overCap };
}

/** SHARE-3: closed band for how many a single Send covered. */
export function inviteCountBand(count: number): "1" | "2-5" | "6-20" {
  if (count <= 1) return "1";
  if (count <= 5) return "2-5";
  return "6-20";
}
