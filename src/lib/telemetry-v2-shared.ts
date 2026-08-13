/**
 * Telemetry v2, the client-safe half: names and enums only.
 *
 * The canonical record (events_v2) is written server side, from server-resolved
 * identity. Nothing here carries an org id, a pseudonym, or any content.
 */
export const EVENT_NAMES_V2 = [
  "episode.created",
  "episode.item_linked",
  "episode.closed",
  "outcome.declared",
  "question.asked",
  "finding.labelled",
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
