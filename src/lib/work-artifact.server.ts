import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { JOURNEY_MIN_UPSTREAM, JOURNEY_THIN_LINE } from "@/lib/journey";
import {
  WORK_ARTIFACT_PRESET,
  WORK_ARTIFACT_PROMPT,
  validateWorkArtifact,
  type ArtifactRecord,
  type WorkArtifact,
} from "@/lib/work-artifact-shared";

type Db = SupabaseClient<Database>;

/**
 * Pass 113. One model call over the record this deliverable already carries,
 * written down as an analysis_runs row with preset 'work_artifact'. It is a run
 * preset and never a chip: nothing in any menu offers it.
 */

export type StoredArtifact = {
  runId: string;
  createdAt: string;
  artifact: WorkArtifact;
};

/** The record as both the model and the honesty gate see it. */
export function buildArtifactRecord(scope: {
  anchorId: string;
  anchorText: string;
  upstream: { id: string; title: string; text: string; turns: { turn_no: number }[] }[];
}): ArtifactRecord {
  return {
    items: [
      ...scope.upstream.map((item) => ({
        id: item.id,
        text: item.text,
        turns: item.turns.map((turn) => ({ turn_no: turn.turn_no })),
      })),
      { id: scope.anchorId, text: scope.anchorText, turns: [] },
    ],
  };
}

export function buildArtifactUser(input: {
  anchorTitle: string;
  anchorId: string;
  anchorText: string;
  brief: string | null;
  upstream: { id: string; title: string; text: string }[];
}): string {
  const blocks = input.upstream
    .map((item) => `ITEM ${item.id}\nTITLE: ${item.title}\n${item.text}`)
    .join("\n\n---\n\n");
  return [
    `FINISHED WORK: ${input.anchorTitle}`,
    input.brief ? `THE BRIEF:\n${input.brief}` : null,
    `THE RECORD:\n\n${blocks}`,
    `ITEM ${input.anchorId}\nTHE FINISHED WORK ITSELF:\n${input.anchorText}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The latest stored artifact for this anchor, read under the caller's own access. */
export async function readWorkArtifact(
  supabase: Db,
  anchorId: string,
): Promise<StoredArtifact | null> {
  const { data } = await supabase
    .from("analysis_runs")
    .select("id, created_at, status, handoffs")
    .eq("preset", WORK_ARTIFACT_PRESET)
    .eq("scope_id", anchorId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const payload = (data.handoffs ?? null) as Record<string, unknown> | null;
  const artifact = (payload?.["work_artifact"] ?? null) as WorkArtifact | null;
  if (!artifact) return null;
  return { runId: data.id, createdAt: data.created_at, artifact };
}

/**
 * Build the artifact. Owner of the deliverable only: a coach reads what is
 * stored and never spends a run. A thin record refuses before any model call.
 */
export async function runWorkArtifact(
  supabase: Db,
  userId: string,
  input: { anchorId: string },
): Promise<StoredArtifact> {
  const { resolveProfile } = await import("./profile-resolve");
  const profile = await resolveProfile(supabase, userId, null);
  if (!profile) throw new Response("Forbidden", { status: 403 });

  const { data: anchor } = await supabase
    .from("work_items")
    .select("id, title, owner_id, org_id")
    .eq("id", input.anchorId)
    .maybeSingle();
  if (!anchor) throw new Error("That item is not available to you.");
  if (profile.role === "coach" || anchor.owner_id !== profile.id) {
    throw new Response("Forbidden", { status: 403 });
  }

  const { loadSpanScope } = await import("./span-audit.server");
  const scope = await loadSpanScope(supabase, anchor.id, anchor.owner_id);
  if (scope.upstream.length < JOURNEY_MIN_UPSTREAM) throw new Error(JOURNEY_THIN_LINE);

  const record = buildArtifactRecord({
    anchorId: anchor.id,
    anchorText: scope.anchorText,
    upstream: scope.upstream,
  });

  const { createRun, completeRun, failRun } = await import("./analysis-runs.server");
  const run = await createRun({
    preset: WORK_ARTIFACT_PRESET,
    scope_type: "deliverable",
    scope_id: anchor.id,
    idempotency_key: `${WORK_ARTIFACT_PRESET}:${anchor.id}:${Date.now()}`,
    org_id: anchor.org_id,
    owner_id: anchor.owner_id,
    run_by_profile_id: profile.id,
    session_id: null,
  });

  const user = buildArtifactUser({
    anchorTitle: scope.anchorTitle,
    anchorId: anchor.id,
    anchorText: scope.anchorText,
    brief: null,
    upstream: scope.upstream,
  });

  let artifact: WorkArtifact;
  let tokensIn = 0;
  let tokensOut = 0;
  let costUsd = 0;
  try {
    const { chatComplete, resolveAiMeta } = await import("./ai.server");
    const { parseJsonObject } = await import("./span-provenance.server");
    const aiMeta = await resolveAiMeta(supabase, {
      surface: `analysis:${WORK_ARTIFACT_PRESET}`,
      orgId: profile.org_id,
      userId,
    });
    const messages = [
      { role: "system" as const, content: WORK_ARTIFACT_PROMPT },
      { role: "user" as const, content: user },
    ];
    let result = await chatComplete(messages, {
      tier: "smart",
      meta: aiMeta,
      responseFormat: { type: "json_object" },
    });
    let parsed = parseJsonObject(result.text);
    tokensIn += result.tokensIn;
    tokensOut += result.tokensOut;
    costUsd += result.costUsd;
    if (Object.keys(parsed).length === 0) {
      // One retry, then fail honestly rather than inventing a card.
      result = await chatComplete(messages, {
        tier: "smart",
        meta: aiMeta,
        responseFormat: { type: "json_object" },
      });
      parsed = parseJsonObject(result.text);
      tokensIn += result.tokensIn;
      tokensOut += result.tokensOut;
      costUsd += result.costUsd;
      if (Object.keys(parsed).length === 0) throw new Error("unparseable");
    }
    artifact = validateWorkArtifact(parsed, record);
  } catch (error) {
    try {
      await failRun(run.id, "model_error");
    } catch {
      // The person still gets the honest failure below.
    }
    throw new Error(
      error instanceof Error && error.message.includes("cap")
        ? error.message
        : "That artifact could not be built. Try again.",
    );
  }

  const claims =
    artifact.how_ai_was_used.length +
    artifact.example_prompts.length +
    artifact.verification_steps.length +
    artifact.decisions.length;

  await completeRun(run.id, {
    items_read: scope.upstream.length + 1,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: Number(costUsd.toFixed(6)),
    claims_rendered: claims,
    suppressed_claims: 0,
    handoffs: { work_artifact: artifact } as never,
  });

  const { recordAiReads } = await import("./ai-reads.server");
  await recordAiReads(
    [
      { workItemId: anchor.id, ownerId: anchor.owner_id, depth: "full" as const },
      ...scope.upstream.map((row) => ({
        workItemId: row.id,
        ownerId: anchor.owner_id,
        depth: "full" as const,
      })),
    ],
    {
      surface: WORK_ARTIFACT_PRESET,
      readerRole: "owner",
      readerProfileId: profile.id,
    },
  );

  const stored = await readWorkArtifact(supabase, anchor.id);
  return stored ?? { runId: run.id, createdAt: new Date().toISOString(), artifact };
}
