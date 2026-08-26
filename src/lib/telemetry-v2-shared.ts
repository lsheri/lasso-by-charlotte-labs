/**
 * Telemetry v2, the client-safe half: names and enums only.
 *
 * The canonical record (events_v2) is written server side, from server-resolved
 * identity. Nothing here carries an org id, a pseudonym, or any content.
 *
 * Product analytics (landing, onboarding, connector setup, navigation, errors)
 * stays in the v1 stream. This registry is the record of practice.
 */

/** 15.1 identity and consent. */
export const EVENTS_IDENTITY = [
  "organization.profile_created",
  "organization.segment_updated",
  "actor.profile_created",
  "actor.segment_updated",
  "cohort.created",
  "cohort.member_joined",
  "consent.presented",
  "consent.granted",
  "consent.declined",
  "consent.withdrawn",
  "consent.policy_changed",
  "retention.policy_applied",
] as const;

/** 15.2 capture and episode. */
export const EVENTS_CAPTURE = [
  "episode.created",
  "episode.objective_confirmed",
  "episode.closed",
  "work_item.unmapped",
  "work_item.marked_private",
  "conversation.pushed",
  "conversation.appended",
  "conversation.turn_revised",
  "artifact.captured",
  "artifact.versioned",
  "brief.linked",
  "rubric.linked",
  "source.linked",
] as const;

/** 15.3 lineage and cross-tool. */
export const EVENTS_LINEAGE = [
  "episode.item_linked",
  "lineage.drafted",
  "lineage.confirmed",
  "lineage.rejected",
  "tool_handoff.inferred",
  "tool_handoff.confirmed",
  "tool_handoff.rejected",
  "model.substituted",
] as const;

/** 15.4 decisions and verification. */
export const EVENTS_DECISION = [
  "decision.drafted",
  "decision.confirmed",
  "decision.edited",
  "decision.discarded",
  "decision.resolved",
  "decision.applied",
  "verification.detected",
  "verification.confirmed",
  "verification.failed",
  "evidence.opened",
] as const;

/** 15.5 questions and analysis. */
export const EVENTS_ANALYSIS = [
  "question.asked",
  "question.refined",
  "question.result_used",
  "analysis.started",
  "analysis.completed",
  "analysis.failed",
  "analysis.handoff_acted",
  "finding.generated",
  "finding.confirmed",
  "finding.edited",
  "finding.rejected",
  "finding.labelled",
  "reflection.started",
  "reflection.completed",
] as const;

/** 15.6 coaching and the 1:1. */
export const EVENTS_COACHING = [
  "coaching.review_started",
  "coaching.question_asked",
  "coaching.note_created",
  "coaching.action_created",
  "coaching.action_accepted",
  "coaching.action_declined",
  "coaching.followup_observed",
  "one_on_one.prepared",
  "one_on_one.opened",
  "one_on_one.used",
  "one_on_one.saved",
] as const;

/** 15.7 outcomes. */
export const EVENTS_OUTCOME = [
  "outcome.declared",
  "outcome.observed",
  "outcome.validated",
  "artifact.delivered",
  "artifact.accepted",
  "rework.requested",
  "episode.reopened",
  "episode.abandoned",
] as const;

export const EVENT_NAMES_V2 = [
  ...EVENTS_IDENTITY,
  ...EVENTS_CAPTURE,
  ...EVENTS_LINEAGE,
  ...EVENTS_DECISION,
  ...EVENTS_ANALYSIS,
  ...EVENTS_COACHING,
  ...EVENTS_OUTCOME,
] as const;

export type EventNameV2 = (typeof EVENT_NAMES_V2)[number];

export type EventSourceV2 = "web" | "mcp" | "connector" | "import" | "system";

export const EPISODE_ITEM_ROLES = [
  "brief",
  "conversation",
  "artifact",
  "source",
  "version",
  "evidence",
] as const;
export type EpisodeItemRole = (typeof EPISODE_ITEM_ROLES)[number];

export const EPISODE_STATUSES = ["open", "delivered", "accepted", "abandoned", "closed"] as const;
export type EpisodeStatus = (typeof EPISODE_STATUSES)[number];

export const OUTCOME_KINDS = [
  "delivered",
  "accepted",
  "rework_requested",
  "time",
  "quality_note",
  "learning_note",
  "business_note",
] as const;
export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

export const OUTCOME_SOURCES = [
  "system_observed",
  "self_reported",
  "manager_validated",
  "teacher_validated",
  "client_validated",
  "external_system",
  "research_adjudicated",
] as const;
export type OutcomeSource = (typeof OUTCOME_SOURCES)[number];

export const QUESTION_INTENT_CLASSES = [
  "verify_claim",
  "trace_decision",
  "prep_1on1",
  "understand_work",
  "summarize",
  "compare",
  "feedback_uptake_check",
  "other",
] as const;
export type QuestionIntentClass = (typeof QUESTION_INTENT_CLASSES)[number];

export const QUESTION_TARGETS = ["own_work", "engagement", "specific_item"] as const;
export const QUESTION_STAGES = ["before_work", "during", "after_delivery", "review"] as const;

export type FindingLabel = "confirmed" | "rejected";

/** The four purposes of the consent ledger, in the order they are shown. */
export const CONSENT_PURPOSES = [
  "operate",
  "customer_analytics",
  "deidentified_improvement",
  "research",
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/** orgs.data_use_tier, highest granted purpose. */
export const DATA_USE_TIERS = [
  "operate",
  "customer_analytics",
  "deidentified_improvement",
  "research",
] as const;

export const WORK_ITEM_TYPES = [
  "ai_thread",
  "document",
  "deck",
  "sheet",
  "call",
  "email",
  "message",
  "image",
] as const;

export const CAPTURE_CHANNELS = ["paste", "upload", "import", "mcp", "connector"] as const;

export const DECISION_STATUSES = ["draft", "confirmed", "discarded"] as const;
