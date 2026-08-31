/**
 * Pass 138: Past work search. One model call over the firm's shipped work.
 *
 * HARD SCOPE RULE: shipped_work is the only gateway. The candidate set is
 * built from shipped_work rows and the columns joined onto them, plus the
 * extract summary of those same ids. Unshipped work items, private items,
 * conversations, and turns are never read here, in any branch.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  buildPastWorkMessages,
  validatePastWorkMatches,
  type PastWorkCandidate,
  type PastWorkSearchResult,
} from "@/lib/past-work-shared";

type Db = SupabaseClient<Database>;

/** The gateway table. Nothing else may open the candidate set. */
export const PAST_WORK_GATEWAY_TABLE = "shipped_work" as const;

/** The one other table read, and only for ids already found in the gateway. */
export const PAST_WORK_SUMMARY_TABLE = "work_item_extracts" as const;

/** A modest budget: this is a short list, not an essay. */
export const PAST_WORK_MAX_TOKENS = 900;

/** How many shipped pieces the model may weigh at once. */
export const PAST_WORK_CANDIDATE_CAP = 60;

type GatewayRow = {
  work_item_id: string;
  engagement_id: string | null;
  work_items: {
    title: string | null;
    type: string | null;
    meta: { deliverable_kind?: string | null } | null;
  } | null;
  engagements: {
    code: string | null;
    title: string | null;
    client_label: string | null;
    brief: string | null;
  } | null;
};

/**
 * The candidate set, read with the caller's own RLS. Shipped rows first, then
 * the summaries of exactly those ids.
 */
export async function assemblePastWorkCandidates(caller: Db): Promise<PastWorkCandidate[]> {
  const { data, error } = await caller
    .from(PAST_WORK_GATEWAY_TABLE)
    .select(
      "work_item_id, engagement_id, work_items(title, type, meta), engagements(code, title, client_label, brief)",
    )
    .order("shipped_at", { ascending: false })
    .limit(PAST_WORK_CANDIDATE_CAP);
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as unknown as GatewayRow[]).filter((row) => row.work_items);
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.work_item_id);
  const summaries = new Map<string, string>();
  const extracts = await caller
    .from(PAST_WORK_SUMMARY_TABLE)
    .select("work_item_id, summary")
    .in("work_item_id", ids);
  for (const row of (extracts.data ?? []) as unknown as {
    work_item_id: string;
    summary: string | null;
  }[]) {
    if (row.summary) summaries.set(row.work_item_id, row.summary.slice(0, 1200));
  }

  return rows.map((row) => ({
    work_item_id: row.work_item_id,
    title: row.work_items?.title ?? "",
    kind: row.work_items?.type ?? "document",
    deliverable_kind: row.work_items?.meta?.deliverable_kind ?? null,
    engagement_id: row.engagement_id,
    engagement_code: row.engagements?.code ?? null,
    engagement_title: row.engagements?.title ?? null,
    client_label: row.engagements?.client_label ?? null,
    brief: row.engagements?.brief ? row.engagements.brief.slice(0, 1200) : null,
    summary: summaries.get(row.work_item_id) ?? null,
  }));
}

/** One description in, up to five shipped matches out. No stream, one call. */
export async function runPastWorkSearch(
  caller: Db,
  input: { description: string; orgId: string; userId: string },
): Promise<PastWorkSearchResult & { candidates: PastWorkCandidate[] }> {
  const candidates = await assemblePastWorkCandidates(caller);

  const { recordEvent } = await import("./telemetry.server");
  const empty = async (): Promise<PastWorkSearchResult & { candidates: PastWorkCandidate[] }> => {
    await recordEvent(caller, {
      eventType: "archive.search",
      orgId: input.orgId,
      userId: input.userId,
      dims: { result_count: 0, had_results: false },
    });
    return { matches: [], result_count: 0, had_results: false, candidates };
  };

  if (candidates.length === 0) return empty();

  const { chatComplete, resolveAiMeta } = await import("./ai.server");
  const aiMeta = await resolveAiMeta(caller as never, {
    surface: "past_work_search",
    orgId: input.orgId,
    userId: input.userId,
  });

  const { system, user } = buildPastWorkMessages(input.description, candidates);
  const result = await chatComplete(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      tier: "smart",
      meta: aiMeta,
      maxTokens: PAST_WORK_MAX_TOKENS,
      responseFormat: { type: "json_object" },
    },
  );

  const { parseJsonObject } = await import("./span-provenance.server");
  const matches = validatePastWorkMatches(parseJsonObject(result.text), candidates);

  // Counts only: what the person typed never travels.
  await recordEvent(caller, {
    eventType: "archive.search",
    orgId: input.orgId,
    userId: input.userId,
    dims: { result_count: matches.length, had_results: matches.length > 0 },
  });

  return {
    matches,
    result_count: matches.length,
    had_results: matches.length > 0,
    candidates,
  };
}
