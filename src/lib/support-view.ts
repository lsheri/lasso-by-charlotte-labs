/** SH-6d-2: shared helpers for the read-only support view. */

const SUPPORT_PATH = /^\/support\/[0-9a-f-]{36}$/;

/** Exactly /support/ followed by a uuid-shaped id, nothing broader. */
export function isSupportPath(next: unknown): next is string {
  return typeof next === "string" && SUPPORT_PATH.test(next);
}

export const SUPPORT_VIEW_COPY = {
  inactive: "This support access is not active.",
  back: "Back to Lasso",
  banner: (name: string, ends: string) => `Support view of ${name}. Read only. Ends ${ends}.`,
  convIncluded: "Conversations: included",
  convHidden: "Conversations: hidden",
  tabs: { home: "Home", boards: "Boards", work: "All work" },
  type: "Type",
  people: "People",
  boardsCount: "Boards",
  reason: "Why access was asked for",
  noBoards: "No boards.",
  noCards: "No cards on this board.",
  noWork: "No work.",
  allBoards: "All boards",
  close: "Close",
  summary: "Summary",
  hiddenConversations: "Conversations are hidden for this support view.",
  noTurns: "No conversation text.",
  loading: "Loading…",
} as const;

/** "19 Oct" */
export function supportShortDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function supportDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
