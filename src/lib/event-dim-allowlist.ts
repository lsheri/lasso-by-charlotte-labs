/**
 * Runtime dimension-key allowlist for every event family outside workboard.*.
 *
 * The TypeScript union is a compile time promise. This file is the runtime
 * one: a key that is not listed against an event name never reaches the
 * events table, so no client content can arrive through a dim by accident.
 *
 * Keyed by full event name, never by family, so a new name in an existing
 * family inherits nothing. Keys only: values are not narrowed here.
 *
 * workboard.* keeps its own guard in workboard-event-allowlist.ts and is
 * folded in below only so the two together cover the whole union.
 */

import type { TelemetryDims, TelemetryEvent } from "./telemetry-shared";
import { WORKBOARD_EVENT_DIMS } from "./workboard-event-allowlist";

/** Every non-workboard event name mapped to the dim keys it may carry. */
export const EVENT_DIM_KEYS: Readonly<Record<string, readonly string[]>> = {
  "admin.dashboard_viewed": ["panels_shown"],
  "affiliation.disclosure_read": ["institution"],
  "analysis.completed": ["claims", "claims_rendered", "confirm_step", "cost_band", "cost_bucket", "deliverable_kind", "entry", "error_class", "handoff_parse", "handoffs_emitted", "items_read", "items_read_bucket", "outcome", "preset", "reason_class", "scope", "scope_type", "status", "suppressed", "suppressed_bucket", "tokens_in_bucket"],
  "analysis.failed": ["claims", "confirm_step", "cost_band", "cost_bucket", "deliverable_kind", "error_class", "handoff_parse", "handoffs_emitted", "items_read", "items_read_bucket", "outcome", "preset", "reason_class", "scope", "scope_type", "status", "suppressed", "suppressed_bucket", "tokens_in_bucket"],
  "analysis.handoff_acted": ["action", "claims", "confirm_step", "cost_band", "cost_bucket", "deliverable_kind", "destination", "error_class", "handoff_parse", "handoffs_emitted", "items_read", "items_read_bucket", "kind", "outcome", "preset", "reason_class", "scope_type", "status", "suppressed", "suppressed_bucket", "tokens_in_bucket"],
  "analysis.reader_story": ["claims", "confirm_step", "cost_band", "cost_bucket", "deliverable_kind", "error_class", "handoff_parse", "handoffs_emitted", "items_read", "items_read_bucket", "outcome", "preset", "reason_class", "scope_type", "status", "suppressed", "suppressed_bucket", "tokens_in_bucket"],
  "analysis.run": ["claims", "confirm_step", "cost_band", "cost_bucket", "deliverable_kind", "error_class", "handoff_parse", "handoffs_emitted", "items_read", "items_read_bucket", "outcome", "preset", "reason_class", "scope_type", "status", "suppressed", "suppressed_bucket", "tokens_in_bucket"],
  "analysis.started": ["claims", "confirm_step", "cost_band", "cost_bucket", "deliverable_kind", "entry", "error_class", "handoff_parse", "handoffs_emitted", "items_read", "items_read_bucket", "outcome", "preset", "reason_class", "scope", "scope_type", "status", "suppressed", "suppressed_bucket", "tokens_in_bucket"],
  "archive.search": ["had_results", "matched", "result_count", "results"],
  "archive.searched": ["had_results", "matched", "result_count", "results"],
  "artifact.declared": ["ai_involvement", "disposition", "output_kind"],
  "board.share_link": ["action", "reason"],
  "brief.cleared": ["scope_type"],
  "brief.marked": ["scope_type"],
  "canvas.node_moved": ["direction", "from", "link_band", "method", "node_band", "shelf_band", "to"],
  "canvas.opened": ["direction", "from", "link_band", "method", "node_band", "shelf_band", "to"],
  "canvas.zoomed": ["direction", "from", "link_band", "method", "node_band", "shelf_band", "to"],
  "capture.context": ["client_name", "client_version", "duration_band", "freshness_band", "had_code_blocks", "had_files", "had_images", "had_tables", "hour_band", "language", "prompt_len_band", "protocol_version", "push_size_band", "response_len_band", "tool_code_execution", "tool_file_tools", "tool_other", "tool_web_search", "weekday"],
  "chatlib.filter_changed": ["filter", "how", "selected", "vendor", "view"],
  "chatlib.panel_opened": ["panel"],
  "reflect.trail_opened": ["read_band", "also_in_band", "not_read_band"],
  "chatlib.reader_closed": ["filter", "how", "selected", "vendor", "view"],
  "chatlib.search": ["filter", "had_click", "how", "query_len_band", "result_band", "selected", "vendor", "view"],
  "chatlib.source_opened": ["filter", "how", "selected", "vendor", "view"],
  "chatlib.view_changed": ["filter", "how", "selected", "vendor", "view"],
  "client.error": ["engagements", "error_name", "fingerprint", "items", "route_class", "source", "unplaced"],
  "client.page_viewed": ["engagements", "error_name", "fingerprint", "items", "route_class", "source", "unplaced"],
  "coach.engagement_shared": ["action", "role"],
  "coach.invite_created": ["entry", "role"],
  "coach.joined": ["role"],
  "coach.outcome": ["rework_needed", "role", "rubric_band", "verdict"],
  "coachchat.asked": ["role"],
  "coachlink.claimed": ["access_level", "basis", "claimed_band", "relation", "scope"],
  "coachlink.consented": ["access_level", "action", "basis", "relation", "scope"],
  "coachlink.created": ["access_level", "basis", "relation", "scope"],
  "coachlink.disclosed": ["access_level", "action", "basis", "relation", "scope"],
  "coachlink.ended": ["access_level", "action", "basis", "relation", "scope"],
  "coachlink.item_excluded": ["access_level", "basis", "relation", "scope"],
  "coachlink.item_restored": ["access_level", "basis", "relation", "scope"],
  "coachlink.withdrawn": ["access_level", "action", "basis", "relation", "scope"],
  "coachnote.read": ["by", "newest_age_band", "notes_shown_band", "surface"],
  "coachnote.replied": ["by", "newest_age_band", "notes_shown_band", "surface"],
  "coachnote.scoped": ["by", "newest_age_band", "notes_shown_band", "scope", "surface"],
  "connector.browse_paged": ["age_filter", "auth_mode", "connected_count", "from", "had_connector", "imported", "page_index", "scope", "surface", "toolkit", "total_count", "type_filter"],
  "connector.browse_result": ["age_filter", "auth_mode", "connected_count", "from", "had_connector", "imported", "page_index", "scope", "surface", "toolkit", "total_count", "type_filter"],
  "connector.enabled": ["age_filter", "auth_mode", "connected_count", "entry", "from", "had_connector", "imported", "page_index", "scope", "surface", "toolkit", "total_count", "type_filter"],
  "connector.error": ["age_filter", "auth_mode", "connected_count", "error_class", "from", "had_connector", "imported", "page_index", "provider", "scope", "surface", "toolkit", "total_count", "type_filter"],
  "connector.setup_opened": ["age_filter", "auth_mode", "connected_count", "from", "had_connector", "imported", "page_index", "scope", "surface", "toolkit", "total_count", "type_filter"],
  "connector.suggestion_reviewed": ["action", "age_filter", "auth_mode", "connected_count", "from", "had_connector", "imported", "page_index", "scope", "source", "surface", "toolkit", "total_count", "type_filter"],
  "connector.suggestion_shown": ["age_filter", "auth_mode", "connected_count", "count", "from", "had_connector", "imported", "page_index", "scope", "source", "surface", "toolkit", "total_count", "type_filter"],
  "connector.surface_opened": ["age_filter", "auth_mode", "connected_count", "from", "had_connector", "imported", "page_index", "scope", "surface", "toolkit", "total_count", "type_filter"],
  "connector.synced": ["age_filter", "auth_mode", "connected_count", "from", "had_connector", "imported", "page_index", "scope", "surface", "toolkit", "total_count", "type_filter"],
  "connector.watch_enabled": ["age_filter", "auth_mode", "connected_count", "from", "had_connector", "imported", "page_index", "scope", "source", "surface", "toolkit", "total_count", "type_filter"],
  "consent.research_change": ["ascending", "choice"],
  "decision.confirmed": ["edited", "evidence_count", "status", "surface"],
  "decision.drafted": ["count", "draft_count", "edited", "scope", "status", "surface", "type"],
  "decision.resolved": ["edited", "status", "surface"],
  "document.recheck_ran": ["changed", "checked", "reason", "refreshed", "source"],
  "document.version_recorded": ["changed", "checked", "reason", "source"],
  "document.versions_expanded": ["changed", "checked", "reason", "source", "version_count"],
  "edu.join_opened": [],
  "engagement.access_changed": ["access", "brief_files", "brief_skipped", "content", "created", "from", "had_conversation", "has_client", "preset", "quick_folder", "result", "scope", "state", "view", "width_bucket"],
  "engagement.ask_rail_toggled": ["access", "brief_files", "brief_skipped", "content", "created", "from", "had_conversation", "has_client", "preset", "quick_folder", "result", "scope", "state", "view", "width_bucket"],
  "engagement.panel_content_changed": ["access", "brief_files", "brief_skipped", "content", "created", "from", "had_conversation", "has_client", "preset", "quick_folder", "result", "scope", "state", "view", "width_bucket"],
  "engagement.scope_changed": ["access", "brief_files", "brief_skipped", "content", "created", "from", "had_conversation", "has_client", "preset", "quick_folder", "result", "scope", "state", "view", "width_bucket"],
  "engagement.tab_analysis_opened": ["access", "brief_files", "brief_skipped", "content", "created", "from", "had_conversation", "has_client", "preset", "quick_folder", "result", "scope", "state", "view", "width_bucket"],
  "engagement.updated": ["access", "brief_files", "brief_skipped", "content", "created", "from", "had_conversation", "has_client", "preset", "quick_folder", "result", "scope", "state", "view", "width_bucket"],
  "engagement.view_changed": ["access", "brief_files", "brief_skipped", "content", "created", "from", "had_conversation", "has_client", "preset", "quick_folder", "result", "scope", "state", "view", "width_bucket"],
  "engagement.wrap_created": ["access", "brief_files", "brief_skipped", "content", "created", "from", "had_conversation", "has_client", "preset", "quick_folder", "result", "scope", "state", "task_count", "view", "width_bucket"],
  "entity.curated": ["action", "had_merge_target"],
  "evidence.opened": ["item_type", "surface"],
  "extract.generated": ["cost_bucket", "mode", "tokens_in_bucket"],
  "feedback.submitted": ["category"],
  "findit.opened": ["considered", "entry", "found", "had_quote", "mode", "result_band", "scope"],
  "findit.quote_shown": ["considered", "entry", "found", "had_quote", "mode", "result_band", "scope"],
  "findit.run": ["behavior", "block", "considered", "entry", "found", "had_quote", "mode", "result_band", "scope"],
  "findit.searched": ["considered", "entry", "found", "had_quote", "mode", "result_band", "scope"],
  "firm.work_shipped": ["coach_count", "has_artifact"],
  "handoff.observed": ["artifact_kind", "from_tool", "to_tool"],
  "home.engagement_opened": [],
  "home.ideas_note_composed": [],
  "home.new_engagement_started": [],
  "home.opened": [],
  "home.past_work_opened": [],
  "import.abandoned": ["last_screen", "tier", "vendor"],
  "import.committed": ["duplicate_count_bucket", "excluded_count_bucket", "last_screen", "selected_count_bucket", "tier", "ts_precision_mix", "vendor"],
  "import.completed": ["entry", "imported_bucket", "last_screen", "tier", "vendor"],
  "import.parsed": ["conversations_found_bucket", "date_span_days_bucket", "last_screen", "parse_failures", "tier", "vendor"],
  "import.started": ["last_screen", "tier", "vendor"],
  "inbox.arrival_undone": ["reverted"],
  "invite.blocked": ["delivered", "reason", "state", "variant"],
  "invite.email_sent": ["delivered", "reason", "resend", "variant"],
  "invite.revoked": ["delivered", "reason", "variant"],
  "landing.pilot_cta_clicked": ["location", "placement"],
  "landing.pilot_requested": ["team_size"],
  "landing.proof_link_opened": ["step", "target"],
  "landing.proof_turn_toggled": ["turn", "state"],
  "landing.see_it_work_clicked": ["location"],
  "landing.section_jumped": ["section"],
  "landing.story_section_viewed": ["input_mode", "section"],
  "landing.usecase_played": ["card", "input_mode"],
  "landing.viewed": ["surface", "variant"],
  "demo.opened": ["surface", "engagement"],
  "demo.card_opened": ["engagement", "kind"],
  "demo.preset_opened": ["code", "position"],
  "demo.turn_opened": ["code", "position"],
  "demo.presets_regenerated": ["code", "answered"],
  "demo.step_completed": ["step", "engagement"],
  "demo.tour_skipped": ["step"],
  "demo.filter_changed": ["tool"],
  "link.drafted": ["action", "considered", "cost_bucket", "count", "relation", "scope", "source", "surface", "tokens_in_bucket"],
  "link.drawn": ["action", "considered", "cost_bucket", "count", "relation", "scope", "source", "surface", "tokens_in_bucket"],
  "link.reviewed": ["action", "considered", "cost_bucket", "count", "relation", "scope", "source", "surface", "tokens_in_bucket"],
  "mcp.container_created": ["attachment_count", "attachment_versions", "degraded_refusals", "has_suggestion", "mode", "rejected_attachments", "suggestion_outcome", "target", "tool", "vendor", "windowed", "workspace_type"],
  "mcp.push": ["attachment_count", "attachment_versions", "attachments_placed", "channel", "decisions", "degraded_refusals", "entry", "has_suggestion", "mode", "rejected_attachments", "source", "suggestion_outcome", "file_refs", "summary_spans", "attachments_held", "text_refs", "target", "tool", "vendor", "windowed"],
  "mcp.push_options_requested": ["attachment_count", "attachment_versions", "degraded_refusals", "has_suggestion", "mode", "rejected_attachments", "suggestion_outcome", "target", "tool", "vendor", "windowed"],
  "member.deactivated": [],
  "member.reactivated": [],
  "member.role_changed": [],
  "model.used": ["length", "model_id", "model_raw", "model_switched", "role", "task_class", "turn_band", "vendor", "via"],
  "note.created": ["cites_count", "days_to_note_band", "entry"],
  "onboarding.tools_selected": ["count"],
  "oneonone.note_added": ["kind"],
  "oneonone.note_discussed": ["kind"],
  "oneonone.prepared": ["entry", "kind", "scope", "window"],
  "oneonone.saved_to_drive": ["kind"],
  "oneonone.session_created": ["kind"],
  "org.created": ["org_type"],
  "packet.viewed": [],
  "perf.interaction": ["dom_ready_ms", "duration_ms", "fcp_ms", "lcp_ms", "load_ms", "name", "phase", "route_class", "state", "surface", "ttfb_ms"],
  "perf.pageload": ["dom_ready_ms", "duration_ms", "fcp_ms", "lcp_ms", "load_ms", "name", "phase", "route_class", "state", "surface", "ttfb_ms"],
  "portfolio.item_added": ["source_section"],
  "portfolio.item_removed": ["source_section"],
  "presence.active": ["engagement_count_band", "week_start"],
  "profile.switched": ["from_role", "same_org", "to_role"],
  "reflect.message_sent": ["answer_retried", "catalogue_size", "context_mode", "finish_reason", "items_fetched", "preset", "quote_repairs", "rounds", "scope", "scope_source", "searches", "suppressed_quotes", "tier2_items", "tool_calls", "truncated", "unmatched_quotes"],
  "reflect.session_created": ["context_mode", "finish_reason", "preset", "quote_repairs", "scope", "suppressed_quotes", "tier2_items", "truncated", "unmatched_quotes"],
  "shared.board_opened": ["boards_band", "granters_band"],
  "task.updated": [],
  "thread.shape": ["from", "has_revision_loop", "role_alternation", "to", "turn_band"],
  "version.recorded": [],
  "walkthrough.opened": ["days_since_signup_band", "entry"],
  "walkthrough.section_viewed": ["position", "section", "variant"],
  "work.piece_regrouped": ["action", "on_board", "piece_kind", "vendor"],
  "work.filter_changed": ["filter", "selected", "result_band"],
  "work.import_menu_opened": [],
  "work.panel_opened": ["panel"],
  "work.preview_mode_changed": ["mode", "kind"],
  "workflow.declared": ["item_count", "process_steps", "step_count", "task_class"],
  "workflow.reordered": ["item_count"],
  "workflow.reset": ["item_count"],
  "workitem.captured": ["channel", "count_bucket", "entry", "source", "type"],
  "workitem.dated": ["channel", "source", "type"],
  "workitem.deleted": ["channel", "on_board", "source", "type"],
  "workitem.journey": ["channel", "output_kind", "source", "type"],
  "workitem.mapped": ["channel", "entry", "source", "suggested", "type"],
  "workitem.marked_private": ["channel", "source", "type"],
  "workspace.affiliated": ["institution"],
} as const;

/**
 * The whole union, both guards together. Typed against TelemetryEvent so a new
 * event name fails to compile until it is listed.
 */
export const ALL_EVENT_DIM_KEYS: Readonly<Record<TelemetryEvent, readonly string[]>> = {
  ...EVENT_DIM_KEYS,
  ...WORKBOARD_EVENT_DIMS,
} as Readonly<Record<TelemetryEvent, readonly string[]>>;

export type EventDimGuardResult = { keep: true; dims: TelemetryDims };

/**
 * Keeps the event, drops any key not listed against its name. An unknown name
 * keeps the event and carries no dims, because nothing vouches for its keys.
 */
export function guardEventDims(name: string, dims: TelemetryDims): EventDimGuardResult {
  const allowed = EVENT_DIM_KEYS[name];
  if (!allowed) {
    console.warn("[telemetry] dims dropped for an unlisted event name");
    return { keep: true, dims: {} };
  }
  const clean: TelemetryDims = {};
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(dims, key)) continue;
    clean[key] = dims[key] as TelemetryDims[string];
  }
  return { keep: true, dims: clean };
}
