/** NC-2: pure notification shapes and copy, shared by the panel and its tests. */

export type NotificationKind =
  | "invite_needs_approval"
  | "share_received"
  | "invite_decided"
  | "invite_accepted"
  | "seat_over_count"
  | "board_activity";

export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  "invite_needs_approval",
  "share_received",
  "invite_decided",
  "invite_accepted",
  "seat_over_count",
  "board_activity",
];

export type NotificationRow = {
  id: string;
  org_id: string | null;
  kind: string;
  section: string;
  subject_type: string | null;
  subject_id: string | null;
  payload: Record<string, string | number | boolean | null>;
  created_at: string;
  read_at: string | null;
  acted_at: string | null;
  /** Present when the row points at a board the reader can open. */
  engagement_id: string | null;
};

export const NOTIFICATION_COPY = {
  title: "Notifications",
  needsYou: "Needs you",
  updates: "Updates",
  empty: "Nothing new.",
  approve: "Approve",
  decline: "Decline",
  approved: "Approved. The invite is on its way.",
  approvedNoEmail:
    "Approved. The email did not send; they can still use the link from the board's Share window.",
  declined: "Declined.",
  bellLabel: "Notifications",
} as const;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Count for the bell: open Needs you rows only, capped at 9+. Empty string means no badge. */
export function badgeCount(rows: readonly Pick<NotificationRow, "section" | "acted_at">[]): string {
  const n = rows.filter((r) => r.section === "needs_you" && !r.acted_at).length;
  if (n <= 0) return "";
  return n > 9 ? "9+" : String(n);
}

export function notificationSentence(row: { kind: string; payload: Record<string, unknown> }): string {
  const p = row.payload ?? {};
  const board = text(p["board"], "A board");
  switch (row.kind) {
    case "invite_needs_approval":
      return `${text(p["by"], "Someone")} wants to invite ${text(p["email"], "someone")} to ${board}.`;
    case "invite_decided":
      return p["approved"] === true
        ? `Your invite to ${text(p["email"], "them")} was approved.`
        : `Your invite to ${text(p["email"], "them")} was not approved.`;
    case "invite_accepted":
      return `${board}: your invite was accepted.`;
    case "share_received":
      return `${board} was shared with you.`;
    case "seat_over_count":
      return `${num(p["filled"]) ?? 0} people on ${num(p["seats"]) ?? 0} seats. Add seats in Settings when you are ready.`;
    case "board_activity": {
      const count = num(p["count"]) ?? 1;
      return `${board}: ${count} new ${count === 1 ? "card" : "cards"}.`;
    }
    default:
      return "";
  }
}

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}
