/** Canonical event registry. Every name here is mirrored to PostHog. */
export type TelemetryEvent =
  | "org.created"
  | "onboarding.tools_selected"
  | "landing.viewed"
  | "workitem.captured"
  | "workitem.mapped"
  | "workitem.marked_private"
  | "workitem.dated"
  | "decision.drafted"
  | "decision.confirmed"
  | "decision.resolved"
  | "connector.enabled"
  | "connector.synced"
  | "connector.watch_enabled"
  | "connector.suggestion_shown"
  | "connector.suggestion_reviewed"
  | "import.started"
  | "import.parsed"
  | "import.committed"
  | "import.completed"
  | "import.abandoned"
  | "mcp.push"
  | "workflow.reordered"
  | "workflow.reset"
  | "coach.invite_created"
  | "coach.joined"
  | "packet.viewed"
  | "note.created"
  | "coachchat.asked"
  | "engagement.updated"
  | "task.updated"
  | "feedback.submitted"
  | "reflect.session_created"
  | "reflect.message_sent"
  | "member.deactivated"
  | "member.reactivated"
  | "member.role_changed"
  | "invite.revoked"
  | "invite.email_sent";

export type TelemetryDims = Record<
  string,
  string | number | boolean | null | Record<string, number>
>;

/** How a work item entered Lasso. Content never travels; the channel does. */
export type CaptureChannel = "paste" | "upload" | "import" | "mcp" | "connector";

/** 0 · 1-10 · 11-50 · 51-200 · 200+ — counts never leave as exact values. */
export function bucket(n: number): string {
  if (n <= 0) return "0";
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  return "200+";
}
