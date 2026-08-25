import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  containsVerbatim,
  normalizeSnippet,
  snippetHash,
  spanIdempotencyKey,
  type SpanLocator,
  type SpanStatus,
  type SpanVerification,
} from "@/lib/span-provenance-shared";

type Db = SupabaseClient<Database>;

/** Every upstream item as the model receives it, and as validation checks it. */
export type UpstreamRecord = {
  id: string;
  title: string;
  /** The full raw text, conversations rendered as numbered turns. */
  text: string;
  turns: { id: string; turn_no: number }[];
};

export type SpanClaim = {
  status: SpanStatus;
  to_item_id: string | null;
  to_turn_id: string | null;
  quote: string | null;
  explanation: string;
  verification: SpanVerification;
  verification_note: string | null;
};

export const SPAN_PROVENANCE_PROMPT = `You are tracing ONE selected span of a finished piece of work back to the record that produced it.

You are given the selected span, the section of the deliverable it sits in, and each upstream item's full raw text. Conversations are numbered "TURN n ROLE:".

Return STRICT JSON and nothing else:
{ "status": "exact" | "paraphrase" | "unsourced", "to_item_id": string, "to_turn_no": number, "quote": string, "explanation": string, "verification": "found" | "none_in_record", "verification_note": string }

RULES:
- The quote MUST be verbatim text copied from the supplied record. Copy it character for character. If you cannot find verbatim support, and cannot find clearly paraphrased support either, the status is "unsourced" with no to_item_id, no to_turn_no and no quote.
- NEVER invent a source, a turn number, or a slide reference. An honest "unsourced" is a true answer and is always better than a guess.
- explanation is at most two sentences, plain, about the work and never about the person.
- verification is "found" ONLY when a LATER turn or a later item in the supplied record shows this fact being checked against another source, and verification_note names that turn or item. Otherwise verification is "none_in_record" and verification_note is empty.
- No durations, no time shares, no judgment of pace, speed or effort anywhere.
- Never use an em dash.`;

export function buildSpanMessages(input: {
  anchorTitle: string;
  sectionLabel: string;
  sectionText: string;
  snippet: string;
  question: string;
  upstream: UpstreamRecord[];
}): { system: string; user: string } {
  const blocks = input.upstream
    .map((item) => `ITEM ${item.id}\nTITLE: ${item.title}\n${item.text}`)
    .join("\n\n---\n\n");
  return {
    system: SPAN_PROVENANCE_PROMPT,
    user: [
      `DELIVERABLE: ${input.anchorTitle}`,
      `${input.sectionLabel}:\n${input.sectionText}`,
      `SELECTED SPAN (verbatim):\n${input.snippet}`,
      `QUESTION: ${input.question}`,
      `THE RECORD:\n\n${blocks}`,
    ].join("\n\n"),
  };
}

/**
 * The honesty gate. A claim only survives when the quote is really in the item
 * it names and the turn it names really exists. Anything else is downgraded to
 * "unsourced" rather than written as a link that reads true and is not.
 */
export function validateSpanClaim(
  raw: {
    status?: unknown;
    to_item_id?: unknown;
    to_turn_no?: unknown;
    quote?: unknown;
    explanation?: unknown;
    verification?: unknown;
    verification_note?: unknown;
  },
  upstream: readonly UpstreamRecord[],
): SpanClaim {
  const explanation = typeof raw.explanation === "string" ? raw.explanation.trim().slice(0, 600) : "";
  const verification: SpanVerification =
    raw.verification === "found" && typeof raw.verification_note === "string" && raw.verification_note.trim()
      ? "found"
      : "none_in_record";
  const verificationNote =
    verification === "found" ? String(raw.verification_note).trim().slice(0, 300) : null;

  const unsourced: SpanClaim = {
    status: "unsourced",
    to_item_id: null,
    to_turn_id: null,
    quote: null,
    explanation,
    verification,
    verification_note: verificationNote,
  };

  const status = raw.status === "exact" || raw.status === "paraphrase" ? raw.status : "unsourced";
  if (status === "unsourced") return unsourced;

  const itemId = typeof raw.to_item_id === "string" ? raw.to_item_id : null;
  const quote = typeof raw.quote === "string" ? raw.quote.trim() : "";
  const item = upstream.find((row) => row.id === itemId) ?? null;
  if (!item || quote.length === 0) return unsourced;
  if (!containsVerbatim(item.text, quote)) return unsourced;

  let turnId: string | null = null;
  if (raw.to_turn_no !== undefined && raw.to_turn_no !== null && raw.to_turn_no !== "") {
    const turnNo = Number(raw.to_turn_no);
    if (!Number.isFinite(turnNo)) return unsourced;
    const turn = item.turns.find((row) => row.turn_no === turnNo) ?? null;
    if (!turn) return unsourced;
    turnId = turn.id;
  }

  return {
    status,
    to_item_id: item.id,
    to_turn_id: turnId,
    quote: quote.slice(0, 2000),
    explanation,
    verification,
    verification_note: verificationNote,
  };
}

export type SpanLinkWritten = {
  id: string;
  from_item_id: string;
  locator: SpanLocator;
  question: string | null;
  to_item_id: string | null;
  to_turn_id: string | null;
  quote: string | null;
  status: SpanStatus;
  verification: SpanVerification;
  verification_note: string | null;
  asked_by: string;
  created_at: string;
};

/** JSON out of a model, whatever fencing it arrived wrapped in. */
export function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * The one write path to span_links. Access is whatever the caller's own client
 * can already read, the scope is the engagement's other items, and the row is
 * only written after the quote has been checked against the record itself.
 */
export async function runSpanProvenance(
  supabase: Db,
  userId: string,
  input: { workItemId: string; locator: SpanLocator; question?: string | null },
): Promise<SpanLinkWritten> {
  const { resolveProfile } = await import("./profile-resolve");
  const profile = await resolveProfile(supabase, userId, null);
  if (!profile) throw new Response("Forbidden", { status: 403 });

  // RLS is the access check: an item the caller cannot read simply is not here.
  const { data: anchor } = await supabase
    .from("work_items")
    .select("id, title, owner_id, org_id")
    .eq("id", input.workItemId)
    .maybeSingle();
  if (!anchor) throw new Error("That item is not available to you.");

  // Asking the same question about the same span twice is the same question:
  // return the answer already in the record rather than stacking another chip.
  const { data: priorLinks } = await supabase
    .from("span_links")
    .select(
      "id, from_item_id, locator, question, to_item_id, to_turn_id, quote, status, verification, verification_note, asked_by, created_at",
    )
    .eq("from_item_id", anchor.id)
    .order("created_at", { ascending: true });
  const wanted = normalizeSnippet(input.locator.snippet);
  const existing = (priorLinks ?? []).find((row) => {
    const loc = row.locator as unknown as SpanLocator | null;
    return (
      Boolean(loc) &&
      loc!.unit === input.locator.unit &&
      loc!.index === input.locator.index &&
      normalizeSnippet(String(loc!.snippet ?? "")) === wanted
    );
  });
  if (existing) return existing as unknown as SpanLinkWritten;

  const { loadSpanScope, sectionFor } = await import("./span-audit.server");
  const scope = await loadSpanScope(supabase, anchor.id, anchor.owner_id);
  if (scope.upstream.length === 0) {
    throw new Error("There is no other work in this engagement to trace this back to.");
  }
  const section = sectionFor(scope.anchorText, input.locator);

  const snippetSha = await snippetHash(input.locator.snippet);
  const idempotencyKey = spanIdempotencyKey({
    anchorId: anchor.id,
    unit: input.locator.unit,
    index: input.locator.index,
    snippetHash: snippetSha,
    upstreamIds: scope.upstream.map((row) => row.id),
  });

  const { createRun, completeRun, failRun, findRunByKey } = await import("./analysis-runs.server");
  const prior = await findRunByKey(idempotencyKey);
  let run: { id: string };
  try {
    run = await createRun({
      preset: "span_provenance",
      scope_type: "deliverable",
      scope_id: anchor.id,
      idempotency_key: prior ? `${idempotencyKey}:${Date.now()}` : idempotencyKey,
      org_id: anchor.org_id,
      owner_id: anchor.owner_id,
      run_by_profile_id: profile.id,
      session_id: null,
    });
  } catch {
    throw new Error("That question could not be asked. Try again.");
  }

  const question = (input.question ?? "").trim().slice(0, 300) || "Where did this come from?";
  const { chatComplete, resolveAiMeta } = await import("./ai.server");
  const { OUTPUT_DISCIPLINE } = await import("./analysis-presets");
  const messages = buildSpanMessages({
    anchorTitle: scope.anchorTitle,
    sectionLabel: section.label,
    sectionText: section.text,
    snippet: input.locator.snippet,
    question,
    upstream: scope.upstream,
  });

  let claim: SpanClaim;
  try {
    const aiMeta = await resolveAiMeta(supabase, {
      surface: "analysis:span_provenance",
      orgId: profile.org_id,
      userId,
    });
    const result = await chatComplete(
      [
        { role: "system", content: `${messages.system}\n\n${OUTPUT_DISCIPLINE}` },
        { role: "user", content: messages.user },
      ],
      { tier: "smart", meta: aiMeta, responseFormat: { type: "json_object" } },
    );
    claim = validateSpanClaim(parseJsonObject(result.text), scope.upstream);
    await completeRun(run.id, {
      items_read: scope.upstream.length + 1,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_usd: Number(result.costUsd.toFixed(6)),
      claims_rendered: claim.status === "unsourced" ? 0 : 1,
      suppressed_claims: 0,
    });
  } catch (error) {
    try {
      await failRun(run.id, "model_error");
    } catch {
      // The person still gets an honest failure below.
    }
    throw new Error(
      error instanceof Error && error.message.includes("cap")
        ? error.message
        : "That question could not be answered. Try again.",
    );
  }

  const { recordAiReads } = await import("./ai-reads.server");
  await recordAiReads(
    [
      { workItemId: anchor.id, ownerId: anchor.owner_id, depth: "full" },
      ...scope.upstream.map((row) => ({
        workItemId: row.id,
        ownerId: anchor.owner_id,
        depth: "full" as const,
      })),
    ],
    {
      surface: "span_provenance",
      readerRole: profile.id === anchor.owner_id ? "owner" : "coach",
      readerProfileId: profile.id,
    },
  );

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: written, error: writeError } = await supabaseAdmin
    .from("span_links")
    .insert({
      org_id: anchor.org_id,
      owner_id: anchor.owner_id,
      asked_by: profile.id,
      from_item_id: anchor.id,
      locator: input.locator as never,
      question,
      to_item_id: claim.to_item_id,
      to_turn_id: claim.to_turn_id,
      to_locator: null,
      quote: claim.quote,
      status: claim.status,
      verification: claim.verification,
      verification_note: claim.verification === "found" ? claim.verification_note : null,
      run_id: run.id,
    })
    .select(
      "id, from_item_id, locator, question, to_item_id, to_turn_id, quote, status, verification, verification_note, asked_by, created_at",
    )
    .single();
  if (writeError || !written) throw new Error("That answer could not be saved. Try again.");
  return written as unknown as SpanLinkWritten;
}
