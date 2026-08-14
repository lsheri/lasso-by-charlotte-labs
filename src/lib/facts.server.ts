import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { hmacHex, pseudonyms } from "./telemetry-v2.server";

/**
 * FACT WRITERS.
 *
 * analytics_core is the analysis layer: pseudonymous, deidentified, and not
 * exposed through the Data API at all. Every write here goes through the
 * service role client, is fire and forget, and swallows its own failures.
 * A fact that fails to land must never be visible to the person working.
 */

/** One extraction version for every derived feature written in this pass. */
export const TAXONOMY = "tax-v1";

type Db = SupabaseClient<Database>;

export type FactContext = {
  /** Caller client, used only to read the org's consent tier. */
  supabase: Db;
  orgId: string;
  profileId: string | null;
  subjectProfileId?: string | null | undefined;
};

type Keys = {
  tenant: string;
  actor: string | null;
  subject: string | null;
  consent: string;
};

async function keysFor(ctx: FactContext): Promise<Keys | null> {
  const key = process.env["TELEMETRY_SALT"];
  if (!key) return null;
  const ids = await pseudonyms(key, ctx.orgId, ctx.profileId, ctx.subjectProfileId ?? null);
  const { data: org } = await ctx.supabase
    .from("orgs")
    .select("data_use_tier")
    .eq("id", ctx.orgId)
    .maybeSingle();
  return { ...ids, consent: org?.data_use_tier ?? "operate" };
}

/**
 * analytics_core is not exposed through the Data API and never will be, so
 * every write goes through a SECURITY DEFINER function in public, executable
 * by the service role only.
 */
async function rpc(fn: string, args: Record<string, unknown>): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as unknown as {
      rpc: (name: string, params: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }).rpc(fn, args);
    if (error) console.error(`[facts] ${fn} failed:`, error.message);
  } catch (e) {
    console.error(`[facts] ${fn} threw:`, (e as Error).message);
  }
}

/** Columns that are not set are omitted, so table defaults still apply. */
function compact(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
}

async function insert(table: string, row: Record<string, unknown>): Promise<void> {
  await rpc("analytics_insert", { p_table: table, p_row: compact(row) });
}

/**
 * A tenant-scoped fingerprint over the question, so repeats can be counted
 * without the text ever leaving the tenant. Keyed, truncated, one way.
 */
export async function tenantFingerprint(orgId: string, text: string): Promise<string | null> {
  const key = process.env["TELEMETRY_SALT"];
  if (!key) return null;
  const normalised = text.toLowerCase().replace(/\s+/g, " ").trim();
  return (await hmacHex(key, `${orgId}:q:${normalised}`)).slice(0, 32);
}

export async function writeQuestionFact(
  ctx: FactContext,
  input: {
    surface: string;
    intentClass?: string | null;
    cognitiveOperation?: string | null;
    target?: string | null;
    stage?: string | null;
    episodeId?: string | null;
    qChars: number;
    /** Raw question text, used only to derive the keyed fingerprint. Never stored. */
    questionText?: string | null;
  },
): Promise<void> {
  const keys = await keysFor(ctx);
  if (!keys || !keys.actor) return;
  const fingerprint = input.questionText
    ? await tenantFingerprint(ctx.orgId, input.questionText)
    : null;
  await insert("fact_question", {
    tenant_pseudo: keys.tenant,
    actor_pseudo: keys.actor,
    episode_id: input.episodeId ?? null,
    surface: input.surface,
    intent_class: input.intentClass ?? null,
    cognitive_operation: input.cognitiveOperation ?? null,
    target: input.target ?? null,
    stage: input.stage ?? null,
    q_chars: Math.max(0, Math.round(input.qChars)),
    fingerprint,
    taxonomy_version: TAXONOMY,
    consent_snapshot: keys.consent,
  });
}

export async function writeDecisionFact(
  ctx: FactContext,
  input: {
    status: string;
    origin?: string | null;
    evidenceCount?: number | null;
    episodeId?: string | null;
    consequenceClass?: string | null;
  },
): Promise<void> {
  const keys = await keysFor(ctx);
  if (!keys || !keys.actor) return;
  await insert("fact_decision", {
    tenant_pseudo: keys.tenant,
    actor_pseudo: keys.actor,
    episode_id: input.episodeId ?? null,
    origin: input.origin ?? null,
    status: input.status,
    evidence_count: input.evidenceCount ?? null,
    consequence_class: input.consequenceClass ?? null,
    taxonomy_version: TAXONOMY,
    consent_snapshot: keys.consent,
  });
}

export async function writeVerificationFact(
  ctx: FactContext,
  input: { kind: string; confirmed: boolean; episodeId?: string | null },
): Promise<void> {
  const keys = await keysFor(ctx);
  if (!keys || !keys.actor) return;
  await insert("fact_verification", {
    tenant_pseudo: keys.tenant,
    actor_pseudo: keys.actor,
    episode_id: input.episodeId ?? null,
    kind: input.kind,
    confirmed: input.confirmed,
    taxonomy_version: TAXONOMY,
    consent_snapshot: keys.consent,
  });
}

export async function writeHandoffFact(
  ctx: FactContext,
  input: {
    fromTool: string;
    toTool: string;
    method: string;
    confirmed: boolean;
    modelSubstitution?: boolean;
    episodeId?: string | null;
  },
): Promise<void> {
  const keys = await keysFor(ctx);
  if (!keys || !keys.actor) return;
  await insert("fact_tool_handoff", {
    tenant_pseudo: keys.tenant,
    actor_pseudo: keys.actor,
    episode_id: input.episodeId ?? null,
    from_tool: input.fromTool.slice(0, 48),
    to_tool: input.toTool.slice(0, 48),
    method: input.method,
    confirmed: input.confirmed,
    model_substitution: input.modelSubstitution ?? false,
    taxonomy_version: TAXONOMY,
  });
}

export async function writeAnalysisFinding(
  ctx: FactContext,
  input: {
    analysisRunId?: string | null;
    presetId: string;
    presetVersion: string;
    scope?: string | null;
    episodeId?: string | null;
    eligibleEpisodes?: number | null;
    evidenceCount?: number | null;
    model?: string | null;
    sensitivityClass?: string | null;
  },
): Promise<void> {
  const keys = await keysFor(ctx);
  if (!keys) return;
  // The fact table's scope vocabulary has no "deliverable"; a deliverable is a
  // single piece of work, so it lands as "item".
  const scope = input.scope === "deliverable" ? "item" : (input.scope ?? null);
  await insert("fact_analysis_finding", {
    analysis_run_id: input.analysisRunId ?? null,
    preset_id: input.presetId.slice(0, 48),
    preset_version: input.presetVersion,
    tenant_pseudo: keys.tenant,
    actor_pseudo: keys.actor,
    episode_id: input.episodeId ?? null,
    scope,
    eligible_episodes: input.eligibleEpisodes ?? null,
    evidence_count: input.evidenceCount ?? null,
    model: input.model ?? null,
    sensitivity_class: input.sensitivityClass ?? "observation",
    consent_snapshot: keys.consent,
  });
}

/** The human label lands later than the finding, so it is an update, not a row. */
export async function labelAnalysisFinding(input: {
  analysisRunId: string;
  response: "confirmed" | "rejected";
  byCoach?: boolean;
}): Promise<void> {
  await rpc("analytics_label_finding", {
    p_run_id: input.analysisRunId,
    p_response: input.response,
    p_by_coach: input.byCoach ?? false,
  });
}

export async function writeCoachingFact(
  ctx: FactContext,
  input: {
    coachProfileId: string;
    subjectProfileId: string;
    reviewSurface: string;
    evidenceOpenedCount?: number | null;
    interventionType?: string | null;
    episodeId?: string | null;
  },
): Promise<void> {
  const key = process.env["TELEMETRY_SALT"];
  if (!key) return;
  const ids = await pseudonyms(key, ctx.orgId, input.coachProfileId, input.subjectProfileId);
  if (!ids.actor || !ids.subject) return;
  const { data: org } = await ctx.supabase
    .from("orgs")
    .select("data_use_tier")
    .eq("id", ctx.orgId)
    .maybeSingle();
  await insert("fact_coaching_interaction", {
    tenant_pseudo: ids.tenant,
    coach_pseudo: ids.actor,
    subject_pseudo: ids.subject,
    episode_id: input.episodeId ?? null,
    review_surface: input.reviewSurface,
    evidence_opened_count: input.evidenceOpenedCount ?? null,
    intervention_type: input.interventionType ?? null,
    consent_snapshot: org?.data_use_tier ?? "operate",
  });
}

export async function writeOutcomeFact(
  ctx: FactContext,
  input: {
    episodeId: string;
    kind: string;
    outcomeSource: string;
    valueClass?: string | null;
  },
): Promise<void> {
  const keys = await keysFor(ctx);
  if (!keys) return;
  await insert("fact_outcome", {
    tenant_pseudo: keys.tenant,
    actor_pseudo: keys.actor,
    episode_id: input.episodeId,
    kind: input.kind,
    value_class: input.valueClass ?? null,
    outcome_source: input.outcomeSource,
    consent_snapshot: keys.consent,
  });
}

/**
 * The episode fact is a recomputed picture, not a log line: it is upserted on
 * episode_id every time the piece of work changes shape or closes.
 */
export async function writeEpisodeFact(ctx: FactContext, episodeId: string): Promise<void> {
  try {
    const keys = await keysFor(ctx);
    if (!keys || !keys.actor) return;
    const { supabase } = ctx;

    const { data: episode } = await supabase
      .from("work_episodes")
      .select("id, opened_at, closed_at, status, owner_id")
      .eq("id", episodeId)
      .maybeSingle();
    if (!episode) return;

    const { data: items } = await supabase
      .from("episode_items")
      .select("item_role, work_items(type)")
      .eq("episode_id", episodeId);
    const rows = (items ?? []) as unknown as {
      item_role: string;
      work_items: { type: string } | null;
    }[];
    const artifactTypes = Array.from(
      new Set(
        rows
          .filter((r) => r.item_role === "artifact")
          .map((r) => r.work_items?.type)
          .filter((t): t is string => Boolean(t)),
      ),
    );
    const { data: outcomes } = await supabase
      .from("episode_outcomes")
      .select("id")
      .eq("episode_id", episodeId)
      .limit(1);
    const { data: org } = await supabase
      .from("orgs")
      .select("org_mode")
      .eq("id", ctx.orgId)
      .maybeSingle();

    await rpc("analytics_upsert_episode", {
      p_row: compact({
        episode_id: episodeId,
        tenant_pseudo: keys.tenant,
        actor_pseudo: keys.actor,
        org_mode: org?.org_mode ?? null,
        artifact_types: artifactTypes,
        opened_at: episode.opened_at,
        closed_at: episode.closed_at,
        status: episode.status,
        item_count: rows.length,
        conversation_count: rows.filter((r) => r.item_role === "conversation").length,
        artifact_count: rows.filter((r) => r.item_role === "artifact").length,
        brief_linked: rows.some((r) => r.item_role === "brief"),
        outcome_labelled: (outcomes ?? []).length > 0,
        taxonomy_version: TAXONOMY,
        consent_snapshot: keys.consent,
      }),
    });
  } catch (e) {
    console.error("[facts] episode fact threw:", (e as Error).message);
  }
}

/** Every derived feature is declared once, with its missingness rule. */
export const DERIVED_FEATURES: {
  feature_name: string;
  definition: string;
  eligible_evidence: string[];
  missingness_rule: string;
}[] = [
  {
    feature_name: "episode_item_count",
    definition: "Count of work items linked to one episode at the time of computation.",
    eligible_evidence: ["episode_items"],
    missingness_rule: "Zero linked items means the episode is not eligible for any comparison.",
  },
  {
    feature_name: "episode_brief_linked",
    definition: "Whether a brief was linked to the episode before it closed.",
    eligible_evidence: ["episode_items"],
    missingness_rule: "Absent brief is recorded as false, never inferred from artifact text.",
  },
  {
    feature_name: "episode_days_open",
    definition: "Whole days between episode open and close, self declared close only.",
    eligible_evidence: ["work_episodes"],
    missingness_rule: "Open episodes are excluded rather than treated as long running.",
  },
  {
    feature_name: "question_intent_class",
    definition: "Model classification of the intent of one question, enums only.",
    eligible_evidence: ["chat_messages"],
    missingness_rule: "Classifier failure writes no fact row rather than a default class.",
  },
  {
    feature_name: "question_repeat_fingerprint",
    definition: "Keyed tenant scoped fingerprint of a normalised question, for repeat counting.",
    eligible_evidence: ["chat_messages"],
    missingness_rule: "No key configured means no fingerprint and no repeat analysis.",
  },
  {
    feature_name: "decision_evidence_count",
    definition: "Number of cited work items behind a confirmed decision.",
    eligible_evidence: ["decisions"],
    missingness_rule: "Decisions without citations are excluded from evidence comparisons.",
  },
  {
    feature_name: "analysis_claims_rendered",
    definition: "Claims that survived the quote check and were shown to the person.",
    eligible_evidence: ["analysis_runs"],
    missingness_rule: "A failed run writes no claim count and is excluded.",
  },
  {
    feature_name: "analysis_user_response",
    definition: "Human label on a rendered finding: confirmed or rejected.",
    eligible_evidence: ["fact_analysis_finding"],
    missingness_rule: "No label means unlabelled, never treated as agreement.",
  },
  {
    feature_name: "tool_handoff_confirmed",
    definition: "A confirmed link where the source tool differs from the destination tool.",
    eligible_evidence: ["work_item_links", "work_items"],
    missingness_rule: "Unconfirmed drafts are excluded from handoff rates.",
  },
  {
    feature_name: "outcome_declared",
    definition: "A human declared outcome on a closed episode, with its source of authority.",
    eligible_evidence: ["episode_outcomes"],
    missingness_rule: "Absent outcome excludes the episode from outcome analysis.",
  },
  {
    feature_name: "capture_coverage",
    definition: "Share of an episode's items captured through a connected channel.",
    eligible_evidence: ["work_items", "episode_items"],
    missingness_rule: "Coverage is reported alongside every claim, never silently assumed complete.",
  },
];

/** Idempotent: the registry is a declaration, so it is upserted by name. */
export async function seedFeatureRegistry(): Promise<{ ok: boolean }> {
  try {
    for (const feature of DERIVED_FEATURES) {
      await rpc("analytics_upsert_feature", {
        p_row: { ...feature, extraction_version: TAXONOMY },
      });
    }
    return { ok: true };
  } catch (e) {
    console.error("[facts] feature registry seed threw:", (e as Error).message);
    return { ok: false };
  }
}
