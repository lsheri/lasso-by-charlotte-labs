// Resend delivery events mapped to outbound_emails.status. Pure, for tests.
// email.opened and email.clicked are deliberately ignored: engagement is a
// fact about the reader, and this product describes work, never workers.

export type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained"
  | "email.failed"
  | "email.opened"
  | "email.clicked";

export type EmailStatus =
  | "queued"
  | "sent"
  | "delayed"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed";

const EVENT_STATUS: Record<string, EmailStatus | null> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.opened": null,
  "email.clicked": null,
};

export function statusForEvent(type: string): EmailStatus | null {
  return Object.prototype.hasOwnProperty.call(EVENT_STATUS, type) ? EVENT_STATUS[type] : null;
}

const RANK: Record<string, number> = { queued: 0, sent: 1, delayed: 2, delivered: 3 };

export function statusRank(status: EmailStatus): number {
  return RANK[status] ?? -1;
}

export function isTerminalFailure(status: EmailStatus): boolean {
  return status === "bounced" || status === "complained" || status === "failed";
}

export function shouldApply(current: string | null, incoming: EmailStatus): boolean {
  if (isTerminalFailure(incoming)) return true;
  const currentRank = current !== null && current in RANK ? RANK[current] : -1;
  return statusRank(incoming) > currentRank;
}
