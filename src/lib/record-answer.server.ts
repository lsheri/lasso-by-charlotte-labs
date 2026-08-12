import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import type { AiReadInput } from "./ai-reads.server";
import type { AiMeta, ChatMessage, ModelTier } from "./ai.server";
import { buildCatalogue, catalogueLine, type Catalogue } from "./record-catalogue.server";
import { RECORD_TOOLS, runRecordTool, type ToolState } from "./record-tools.server";
import { RAW_BUDGET } from "./reflect-context.server";
import type { ContextScope, ContextSource } from "./reflect-shared";

type Db = SupabaseClient<Database>;

/** Enough rounds to search, narrow and read. More than this is a loop. */
const MAX_ROUNDS = 4;
/** Fetching must never eat the whole answer window. */
const FETCH_BUDGET_MS = 60_000;

export const CATALOGUE_RULES = `HOW TO USE THE RECORD IN THIS ANSWER
You have been given a CATALOGUE: one line for every piece of recorded work in scope, with a short code, a date, a type, its mapping and its topics. The catalogue is an index, not the work. You have NOT read anything you have not fetched.

Tools:
  search_record  find catalogued items by word or phrase, across titles, summaries and conversation text
  open_items     read the summary card for up to 20 items, cheap
  read_items     read the full text of up to 5 items, expensive and budgeted
  read_turns     read a range of turns from one conversation, verbatim

Rules:
1. Search or open before you answer any question that names a topic, person, client, decision or period. Do not answer from catalogue lines alone.
2. Summary cards are somebody else's compression. You may reason from them, but you may NEVER quote them.
3. Quotation marks may only ever go around text returned by read_items or read_turns, or text in THE BRIEF, copied character for character.
4. If a fetch fails or the budget runs out, say plainly what you could not read. Never fill the gap with invention.
5. When you have everything you need, stop calling tools and reply with the single word READY. Do not write the answer while tools are still available.`;

export type CatalogueAnswer = {
  answer: string;
  quotable: string;
  reads: AiReadInput[];
  sources: ContextSource[];
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  rounds: number;
  toolCalls: number;
  searches: number;
  itemsFetched: number;
  finishReason: string;
};

/** The prompt block that stands in for pouring the whole record into context. */
export function catalogueContext(catalogue: Catalogue): string {
  const parts = [catalogue.brief.block, ...catalogue.structure];
  parts.push(
    [
      `CATALOGUE: ${catalogue.entries.length} piece${catalogue.entries.length === 1 ? "" : "s"} of recorded work in scope.`,
      "Format: code | date | type | vendor when known | mapping | title | topics",
      ...catalogue.entries.map(catalogueLine),
    ].join("\n"),
  );
  if (catalogue.prefetched.size > 0) {
    parts.push(
      ["ALREADY OPENED FOR YOU (summary cards, never quotable):", ...catalogue.prefetched.values()].join(
        "\n\n",
      ),
    );
  }
  return parts.join("\n\n---\n\n");
}

/**
 * The catalogue answer: the model is given an index of the whole record and
 * fetches what it needs, instead of being handed a truncated pour of it. Tool
 * rounds are planning only; the answer itself is one final call, so it streams.
 */
export async function runCatalogueAnswer(
  supabase: Db,
  input: {
    ownerId: string;
    scope: ContextScope;
    prompts: ChatMessage[];
    history: ChatMessage[];
    question: string;
    meta: AiMeta;
    tier?: ModelTier;
    timeoutMs?: number;
  },
  onDelta?: (delta: string) => void,
): Promise<CatalogueAnswer & { catalogue: Catalogue }> {
  const catalogue = await buildCatalogue(supabase, input.ownerId, input.scope);
  const state: ToolState = {
    supabase,
    ownerId: input.ownerId,
    catalogue,
    rawBudget: Math.max(0, RAW_BUDGET - catalogue.brief.chars),
    rawUsed: 0,
    deadline: Date.now() + FETCH_BUDGET_MS,
    opened: new Set(catalogue.prefetched.keys()),
    readFull: new Set(),
    unreadable: new Map(),
    quotable: [catalogue.brief.block],
    searches: 0,
    toolCalls: 0,
  };

  const base: ChatMessage[] = [
    ...input.prompts,
    { role: "system", content: CATALOGUE_RULES },
    { role: "system", content: catalogueContext(catalogue) },
    ...input.history,
    { role: "user", content: input.question },
  ];

  const { chatComplete, streamChat } = await import("./ai.server");
  const conversation: ChatMessage[] = [...base];
  let tokensIn = 0;
  let tokensOut = 0;
  let costUsd = 0;
  let rounds = 0;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const lastRound = round === MAX_ROUNDS - 1;
    const planning = await chatComplete(conversation, {
      tier: input.tier ?? "smart",
      maxTokens: 2000,
      tools: RECORD_TOOLS,
      meta: input.meta,
      ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
    });
    tokensIn += planning.tokensIn;
    tokensOut += planning.tokensOut;
    costUsd += planning.costUsd;
    rounds += 1;
    if (planning.toolCalls.length === 0) break;

    conversation.push({
      role: "assistant",
      content: planning.text,
      tool_calls: planning.toolCalls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.arguments },
      })),
    });
    for (const call of planning.toolCalls) {
      let output: string;
      try {
        output = await runRecordTool(state, call.name, call.arguments);
      } catch (e) {
        // A failing fetch loses one tool result, not the whole question.
        const { logHealth } = await import("./health.server");
        await logHealth({
          kind: "error",
          surface: "record_tools",
          orgId: input.meta?.orgId,
          detail: "record_tool_failed",
          meta: { tool: call.name, error_name: (e as Error).name },
        }).catch(() => undefined);
        output = "That fetch failed. Continue with what you already have.";
      }
      conversation.push({ role: "tool", content: output, tool_call_id: call.id });
    }
    if (lastRound || Date.now() > state.deadline) {
      conversation.push({
        role: "system",
        content:
          "No more fetching is possible for this answer. Answer with what you have, and say plainly what you did not read.",
      });
      break;
    }
  }

  conversation.push({
    role: "user",
    content:
      "Now write the answer, using only what you fetched and what is in the brief. Quote only text you fetched verbatim.",
  });

  const final = onDelta
    ? await streamChat(conversation, onDelta, {
        tier: input.tier ?? "smart",
        maxTokens: 8000,
        meta: input.meta,
        ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
      })
    : await chatComplete(conversation, {
        tier: input.tier ?? "smart",
        maxTokens: 8000,
        meta: input.meta,
        ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
      });
  tokensIn += final.tokensIn;
  tokensOut += final.tokensOut;
  costUsd += final.costUsd;

  // What the model actually saw, item by item, recorded honestly.
  const reads: AiReadInput[] = [...catalogue.brief.reads];
  const sources: ContextSource[] = [...catalogue.brief.sources];
  for (const entry of catalogue.entries) {
    const depth = state.readFull.has(entry.id)
      ? "full"
      : state.unreadable.has(entry.id)
        ? "unreadable"
        : state.opened.has(entry.id)
          ? "extract"
          : "catalogue";
    reads.push({ workItemId: entry.id, ownerId: input.ownerId, depth });
    sources.push({
      id: entry.id,
      title: entry.title,
      type: entry.type,
      source_vendor: entry.vendor,
      depth,
    });
  }

  return {
    answer: final.text,
    quotable: state.quotable.join("\n\n"),
    reads,
    sources,
    tokensIn,
    tokensOut,
    costUsd: Number(costUsd.toFixed(6)),
    rounds,
    toolCalls: state.toolCalls,
    searches: state.searches,
    itemsFetched: state.readFull.size,
    finishReason: final.finishReason,
    catalogue,
  };
}