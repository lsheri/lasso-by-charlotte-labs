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
  | "connector.error"
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
  | "coach.engagement_shared"
  | "packet.viewed"
  | "admin.dashboard_viewed"
  | "note.created"
  | "coachchat.asked"
  | "engagement.updated"
  | "task.updated"
  | "feedback.submitted"
  | "reflect.session_created"
  | "reflect.message_sent"
  | "analysis.started"
  | "analysis.run"
  | "analysis.completed"
  | "analysis.failed"
  | "analysis.handoff_acted"
  /** Pass 128: how the reader's intro story resolved. Outcome only. */
  | "analysis.reader_story"
  | "member.deactivated"
  | "member.reactivated"
  | "member.role_changed"
  | "invite.revoked"
  | "invite.email_sent"
  | "invite.blocked"
  | "oneonone.prepared"
  | "oneonone.saved_to_drive"
  | "link.drafted"
  | "link.reviewed"
  | "evidence.opened"
  | "version.recorded"
  | "brief.marked"
  | "brief.cleared"
  | "extract.generated"
  /** Pass 125: one archive search, metered. Counts only, never the question. */
  | "archive.searched"
  /** Pass 138: one Past work search. Counts only, never the description. */
  | "archive.search"
  /** Client-side interaction timing. Emitted only by src/lib/perf-timing.ts. */
  | "perf.interaction"
  /** Hard document load timing. Emitted only by src/lib/pageload-timing.ts. */
  | "perf.pageload"
  /** Content-free client error signal. Emitted only by src/lib/error-signal.ts. */
  | "client.error"
  /** Pass 145: one row per person per ISO week. Counts only, banded. */
  | "presence.active"
  /** Pass 147: a person joined or left research. Choice only. */
  | "consent.research_change";

export type TelemetryDims = Record<
  string,
  string | number | boolean | null | Record<string, number>
>;

/** How a work item entered Lasso. Content never travels; the channel does. */
export type CaptureChannel = "paste" | "upload" | "import" | "mcp" | "connector";

/** 0 · 1-10 · 11-50 · 51-200 · 200+, counts never leave as exact values. */
export function bucket(n: number): string {
  if (n <= 0) return "0";
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  return "200+";
}
