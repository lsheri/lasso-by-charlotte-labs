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
  /** Pass 160: the AI setup steps were opened. Surface and a boolean only. */
  | "connector.setup_opened"
  /** Pass 165: someone loaded a further page of a connector listing. */
  | "connector.browse_paged"
  /** Pass 169: how the first page of a connector listing resolved. */
  | "connector.browse_result"
  /** Pass 173: the connectors surface was opened. Entry point and counts. */
  | "connector.surface_opened"
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
  | "client.page_viewed"
  | "admin.dashboard_viewed"
  | "note.created"
  | "coachchat.asked"
  /**
   * Pass 170: coaching links, person to person. Every one of these carries the
   * basis, relation, access level and scope only. Never a name, never a count
   * shown back to anyone in the product.
   */
  | "coachlink.created"
  /** Pass 171: a coach accepted an invite and picked up the links waiting for them. */
  | "coachlink.claimed"
  | "coachlink.consented"
  | "coachlink.disclosed"
  | "coachlink.withdrawn"
  | "coachlink.ended"
  | "coachlink.item_excluded"
  | "coachlink.item_restored"
  | "engagement.updated"
  /** A person opened or collapsed the engagement Ask rail. */
  | "engagement.ask_rail_toggled"
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
  | "consent.research_change"
  /** Pass 148: one captured item, the tool and coarse shape of the work. */
  | "model.used"
  /** Pass 148: the shape of a captured conversation. Bands and counts only. */
  | "thread.shape"
  /** Pass 155: the machine context of one capture. Bands, counts, codes. */
  | "capture.context"
  /** Pass 148: a link between two pieces of work, tool to tool. */
  | "handoff.observed"
  /** Pass 150: what the person said their finished work is. Closed vocab. */
  | "artifact.declared"
  /** Pass 150: how the person said they worked, at the mapping moment. */
  | "workflow.declared"
  /** Pass 153: the banded shape of how one item came to be, at ship time. */
  | "workitem.journey"
  /** Pass 150: a coach's read on work they reviewed. Closed vocab. */
  | "coach.outcome"
  /** Chat library: someone opened the original chat. Tool name only. */
  | "chatlib.source_opened"
  /** Pass 157b: one settled chat library search. Bands only in dims. */
  | "chatlib.search"
  /** Pass 159: a person changed the profile they are acting as. Roles only. */
  | "profile.switched"
  /** Pass 161: the subject opened notes about their work. One per view. */
  | "coachnote.read"
  /** Pass 164: the walkthrough was opened. Variant, entry, banded age only. */
  | "walkthrough.opened"
  /** Pass 164: one walkthrough section was reached. Closed vocab section id. */
  | "walkthrough.section_viewed"
  /** Pass 167: a person settled one subject. Action and a boolean only. */
  | "entity.curated"
  /** Pass 172: the school entry page was opened. No names, no free text. */
  | "edu.join_opened"
  /** Pass 172: a person promoted one piece of work. Closed source section. */
  | "portfolio.item_added"
  /** Pass 172: a person took one piece of work back off the Portfolio. */
  | "portfolio.item_removed";

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
