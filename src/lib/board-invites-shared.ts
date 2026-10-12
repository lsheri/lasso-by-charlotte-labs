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
};

export const ACCEPT_COPY = {
  heading: (by: string, board: string) => `${by} invited you to ${board}`,
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
