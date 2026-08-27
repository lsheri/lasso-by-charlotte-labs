/**
 * Pass 124: one grounded model call over the firm archive. Retrieval is the
 * caller's own RLS read of shipped_work, joined with each piece's latest
 * completed Work Artifact payload. Nothing is written: this is search, not a
 * record. Cost and tokens are accounted by chatComplete's own usage path, the
 * same one every analysis uses.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { OUTPUT_DISCIPLINE } from "@/lib/analysis-presets";
import {
  ARCHIVE_MIN_ITEMS,
  buildArchiveMessages,
  validateArchiveMatches,
  type ArchiveCorpusEntry,
  type ArchiveSearchResult,
} from "@/lib/archive-search-shared";
import { WORK_ARTIFACT_PRESET, type WorkArtifact } from "@/lib/work-artifact-shared";

type Db = SupabaseClient<Database>;

/** The Work Artifact flattened to the plain sentences a search can read. */
export function artifactText(artifact: WorkArtifact | null): string {
  if (!artifact) return "";
  const lines: string[] = [];
  for (const stage of artifact.how_ai_was_used ?? [])
    lines.push(`${stage.stage}: ${stage.what_happened}`);
  for (const prompt of artifact.example_prompts ?? [])
    lines.push(`${prompt.quote} (${prompt.why_it_worked})`);
  for (const check of artifact.verification_steps ?? [])
    lines.push(`${check.step}: ${check.evidence}`);
  for (const decision of artifact.decisions ?? []) lines.push(decision.decision);
  for (const step of artifact.process_steps ?? []) lines.push(step);
  for (const gap of artifact.honest_gaps ?? []) lines.push(gap);
  return lines.join("\n").slice(0, 4000);
}

/** The archive as this caller may see it, with artifacts where they exist. */
export async function buildArchiveCorpus(caller: Db): Promise<ArchiveCorpusEntry[]> {
  const { listShippedCards } = await import("./shipped-work.server");
  const cards = await listShippedCards(caller as never);
  if (cards.length === 0) return [];

  const ids = cards.map((card) => card.work_item_id);
  const { data: runs } = await caller
    .from("analysis_runs")
    .select("scope_id, created_at, handoffs")
    .eq("preset", WORK_ARTIFACT_PRESET)
    .eq("status", "completed")
    .in("scope_id", ids)
    .order("created_at", { ascending: false });

  const latest = new Map<string, WorkArtifact>();
  for (const row of (runs ?? []) as unknown as {
    scope_id: string | null;
    handoffs: Record<string, unknown> | null;
  }[]) {
    if (!row.scope_id || latest.has(row.scope_id)) continue;
    const payload = (row.handoffs?.["work_artifact"] ?? null) as WorkArtifact | null;
    if (payload) latest.set(row.scope_id, payload);
  }

  return cards.map((card) => ({
    work_item_id: card.work_item_id,
    title: card.title,
    engagement_title: card.engagement_title,
    brief: card.engagement_brief,
    artifact_text: artifactText(latest.get(card.work_item_id) ?? null),
  }));
}

/** One question, one model call, ids validated against the corpus. */
export async function runArchiveSearch(
  caller: Db,
  input: { question: string; orgId: string; userId: string; profileId: string },
): Promise<ArchiveSearchResult> {
  const corpus = await buildArchiveCorpus(caller);
  if (corpus.length < ARCHIVE_MIN_ITEMS) {
    // A short circuit spends nothing, so it records nothing.
    return { matches: [], best_match_id: null, too_small: true };
  }

  const { chatComplete, resolveAiMeta, AiError } = await import("./ai.server");
  const { parseJsonObject } = await import("./span-provenance.server");
  const { createRun, completeRun, failRun } = await import("./analysis-runs.server");
  const { recordEvent } = await import("./telemetry.server");
  const { bucket } = await import("./telemetry-shared");

  const aiMeta = await resolveAiMeta(caller as never, {
    surface: "archive_search",
    orgId: input.orgId,
    userId: input.userId,
  });

  const run = await createRun({
    preset: "archive_search",
    scope_type: "org",
    scope_id: null,
    idempotency_key: null,
    org_id: input.orgId,
    owner_id: input.profileId,
    run_by_profile_id: input.profileId,
    session_id: null,
  });

  const { system, user } = buildArchiveMessages(input.question, corpus);
  let result;
  try {
    result = await chatComplete(
      [
        { role: "system", content: `${system}\n\n${OUTPUT_DISCIPLINE}` },
        { role: "user", content: user },
      ],
      { tier: "smart", meta: aiMeta, responseFormat: { type: "json_object" } },
    );
  } catch (e) {
    const errorClass = e instanceof AiError ? e.errorClass : "model_error";
    // A failed bookkeeping write must never hide the real failure.
    await failRun(run.id, errorClass).catch(() => {});
    throw e;
  }

  const parsed = parseJsonObject(result.text);
  const offered = Array.isArray(parsed["matches"]) ? (parsed["matches"] as unknown[]).length : 0;
  const validated = validateArchiveMatches(parsed, corpus);

  await completeRun(run.id, {
    items_read: corpus.length,
    tokens_in: result.tokensIn,
    tokens_out: result.tokensOut,
    cost_usd: result.costUsd,
    claims_rendered: validated.matches.length,
    suppressed_claims: Math.max(offered - validated.matches.length, 0),
    handoffs: null,
    context_manifest: null,
  });

  // Counts only: the question never travels.
  await recordEvent(caller, {
    eventType: "archive.searched",
    orgId: input.orgId,
    userId: input.userId,
    dims: { results: bucket(validated.matches.length), matched: validated.matches.length > 0 },
  });

  return { ...validated, too_small: false };
}

