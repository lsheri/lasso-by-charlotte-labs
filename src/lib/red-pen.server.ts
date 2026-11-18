/**
 * Red pen, server side. One fast-tier call lists the deliverable's checkable claims as exact snippets; code keeps only
 * snippets really in it. Claims are then traced in batches of eight on the smart tier against the board's sources
 * most likely to hold them, and every answer passes validateSpanClaim: a source counts only when its quote is found
 * word for word. The call is passed in, so this is tested without a model.
 */

import type { ChatMessage, ChatOptions, ChatResult } from "@/lib/ai.server";
import { parseJsonObject, validateSpanClaim, type UpstreamRecord } from "@/lib/span-provenance.server";

import {
  checkExtracted,
  countGrades,
  gradeOf,
  rankSources,
  RED_PEN_BATCH,
  RED_PEN_CLAIMS_MAX,
  RED_PEN_SOURCE_CHARS,
  RED_PEN_SOURCES_PER_BATCH,
  type RedPenClaim,
  type RedPenResult,
} from "./red-pen-shared";

type Chat = (messages: ChatMessage[], options: ChatOptions) => Promise<ChatResult>;

export type RedPenUsage = { costUsd: number; tokensIn: number; tokensOut: number; calls: number };

const EXTRACT_SYSTEM = [
  "You list the checkable claims in a consulting deliverable: headlines, numbers, findings and recommendations that a partner would want sourced.",
  `Return JSON only: {"claims": [{"text": "<the claim, copied exactly from the deliverable>"}]}. At most ${RED_PEN_CLAIMS_MAX}.`,
  "Copy each claim character for character, one sentence or one line at most. Skip titles, agendas, labels and slide numbers.",
].join("\n");

const TRACE_SYSTEM = `You check claims from a consulting deliverable against the record that should support them.

You are given numbered CLAIMS and each upstream item's full raw text. Conversations are numbered "TURN n ROLE:".

Return STRICT JSON and nothing else:
{ "results": [ { "claim": <number>, "status": "exact" | "paraphrase" | "unsourced", "to_item_id": string, "to_turn_no": number, "quote": string, "explanation": string } ] }

RULES:
- One result per claim number.
- to_turn_no is only for conversations ("TURN n ROLE:"). For a document, deck or sheet, leave it out.
- "exact": the record states the same fact. "paraphrase": the record says something close but not the same (a different number, a softer claim, a different scope). "unsourced": nothing in the record supports it.
- The quote MUST be verbatim text copied from the supplied record, character for character. If you cannot quote support, the status is "unsourced" with no to_item_id and no quote.
- NEVER invent a source or a turn number. An honest "unsourced" is always better than a guess.
- explanation is at most one sentence, plain, about the work and never about a person.
- Never use an em dash.`;

/** Claims from a reply cut off at its token limit: every complete "text" value. */
function salvageTexts(text: string): string[] {
  return [...text.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1]!.replace(/\\"/g, '"').replace(/\\n/g, "\n"));
}

/**
 * The model fills to_turn_no even for documents, which have no turns; the validator would then reject a good quote.
 * A turn number only means something on a conversation, so it is dropped for any other item.
 */
export function withoutDocumentTurn(answer: Record<string, unknown>, sources: readonly UpstreamRecord[]): Record<string, unknown> {
  const item = sources.find((source) => source.id === answer["to_item_id"]);
  if (!item || item.turns.length > 0 || !("to_turn_no" in answer)) return answer;
  const { to_turn_no: _ignored, ...rest } = answer;
  return rest;
}

export async function runRedPen(
  chat: Chat,
  input: { itemId: string; anchorTitle: string; anchorText: string; upstream: UpstreamRecord[]; meta: ChatOptions["meta"]; now?: Date },
): Promise<{ result: RedPenResult; usage: RedPenUsage }> {
  const usage: RedPenUsage = { costUsd: 0, tokensIn: 0, tokensOut: 0, calls: 0 };
  const count = (result: ChatResult) => {
    usage.costUsd += result.costUsd;
    usage.tokensIn += result.tokensIn;
    usage.tokensOut += result.tokensOut;
    usage.calls += 1;
  };
  const withMeta = (surface: string) => (input.meta ? { meta: { ...input.meta, surface } } : {});
  // A deliverable with no text has no claims; no call is spent finding that out.
  if (!input.anchorText.trim()) {
    return { result: { itemId: input.itemId, checkedAt: (input.now ?? new Date()).toISOString(), claims: [], sourcesRead: 0, counts: countGrades([]) }, usage };
  }

  const extract = await chat(
    [
      { role: "system", content: EXTRACT_SYSTEM },
      { role: "user", content: `DELIVERABLE: ${input.anchorTitle}\n\n${input.anchorText}` },
    ],
    { tier: "fast", maxTokens: 4_000, responseFormat: { type: "json_object" }, ...withMeta("red_pen_extract") },
  );
  count(extract);
  const parsed = parseJsonObject(extract.text)["claims"];
  const claims = checkExtracted(Array.isArray(parsed) ? parsed : salvageTexts(extract.text), input.anchorText);

  const sources = input.upstream.map((item) => ({ ...item, text: item.text.slice(0, RED_PEN_SOURCE_CHARS) }));
  const read = new Set<string>();
  const out: RedPenClaim[] = [];
  for (let start = 0; start < claims.length; start += RED_PEN_BATCH) {
    const batch = claims.slice(start, start + RED_PEN_BATCH);
    const ranked = rankSources(batch.map((claim) => claim.snippet), sources, RED_PEN_SOURCES_PER_BATCH);
    for (const source of ranked) read.add(source.id);
    let results: Record<string, unknown>[] = [];
    if (ranked.length) {
      const record = ranked.map((item) => `ITEM ${item.id}\nTITLE: ${item.title}\n${item.text}`).join("\n\n---\n\n");
      const list = batch.map((claim, index) => `${index + 1}. ${claim.snippet}`).join("\n");
      const trace = await chat(
        [
          { role: "system", content: TRACE_SYSTEM },
          { role: "user", content: `DELIVERABLE: ${input.anchorTitle}\n\nCLAIMS:\n${list}\n\nTHE RECORD:\n\n${record}` },
        ],
        { tier: "smart", maxTokens: 3_000, responseFormat: { type: "json_object" }, ...withMeta("red_pen_trace") },
      );
      count(trace);
      const raw = parseJsonObject(trace.text)["results"];
      results = Array.isArray(raw) ? (raw.filter((entry) => entry && typeof entry === "object") as Record<string, unknown>[]) : [];
    }
    batch.forEach((claim, index) => {
      const answer = withoutDocumentTurn(results.find((entry) => Number(entry["claim"]) === index + 1) ?? {}, ranked);
      const checked = validateSpanClaim(answer, ranked);
      const source = checked.to_item_id ? ranked.find((item) => item.id === checked.to_item_id) : undefined;
      out.push({
        snippet: claim.snippet,
        slide: claim.slide,
        grade: gradeOf(checked.status),
        sourceItemId: checked.to_item_id,
        sourceTitle: source?.title ?? null,
        quote: checked.quote,
        note: checked.explanation,
      });
    });
  }

  return {
    result: { itemId: input.itemId, checkedAt: (input.now ?? new Date()).toISOString(), claims: out, sourcesRead: read.size, counts: countGrades(out) },
    usage,
  };
}
