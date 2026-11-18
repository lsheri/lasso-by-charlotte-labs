/**
 * Start a proposal, step 1, server side. The new board is read with the person's own access (it is theirs and usually
 * not shared); precedents come only through the firm reader. Two fast-tier calls: one fills a six-line brief from the
 * board's notes, one picks up to three precedents from board cards. Every text the model reads has money masked.
 * The call and the readers are passed in, so this is tested without a model or a database.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChatMessage, ChatOptions, ChatResult } from "@/lib/ai.server";
import type { Database } from "@/integrations/supabase/types";
import { parseJsonObject } from "@/lib/span-provenance.server";

import { maskFees } from "./firm-ask-shared";
import type { FirmCorpus } from "./firm-corpus-shared";
import { checkPicks, cleanBrief, PRECEDENTS_MAX, PROPOSAL_BRIEF_FIELDS, type ProposalBrief } from "./proposal-shared";

type Db = SupabaseClient<Database>;
type Chat = (messages: ChatMessage[], options: ChatOptions) => Promise<ChatResult>;

/** About 6,000 tokens of the board's own notes. */
export const NOTES_CHARS = 24_000;

/** The new board's notes, read with the person's own access: its brief, then each placed item's text or card. */
export async function readPursuitNotes(caller: Db, engagementId: string, loadText: (itemId: string) => Promise<string | null>): Promise<string> {
  const { data: board, error } = await caller.from("engagements").select("title, brief").eq("id", engagementId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!board) throw new Response("Not found", { status: 404 });
  const { data: placed } = await caller
    .from("work_item_tasks")
    .select("work_item_id, tasks!inner(engagement_id), work_items!inner(id, title, type, visibility)")
    .eq("tasks.engagement_id", engagementId)
    .neq("work_items.visibility", "private");
  const items = ((placed ?? []) as unknown as { work_items: { id: string; title: string; type: string } }[]).map((row) => row.work_items);
  const parts = [`BOARD: ${board.title}`, board.brief ? `BRIEF: ${board.brief}` : ""];
  for (const item of items) {
    const text = await loadText(item.id);
    if (text) parts.push(`--- ${item.type}: ${item.title}\n${text}`);
    if (parts.join("\n\n").length > NOTES_CHARS) break;
  }
  return maskFees(parts.filter(Boolean).join("\n\n")).slice(0, NOTES_CHARS);
}

const BRIEF_SYSTEM = [
  "You turn a consulting firm's intake notes for a new opportunity into a six-line brief.",
  `Return JSON only, with exactly these keys: ${PROPOSAL_BRIEF_FIELDS.join(", ")}.`,
  "client: the kind of client, not its name (for example \"regional health system, 3 hospitals\").",
  "problem: what they want solved, in one sentence.",
  "deadline: when they need it, as stated.",
  "decider: the role who decides, never a person's name.",
  "size: rough size or length if stated, else empty. Never a fee.",
  "outOfScope: what is out of scope if stated, else empty.",
  "Use only what the notes say. Leave a field empty rather than guess.",
].join("\n");

export async function draftBrief(chat: Chat, notes: string, meta: ChatOptions["meta"]): Promise<ProposalBrief> {
  const result = await chat(
    [
      { role: "system", content: BRIEF_SYSTEM },
      { role: "user", content: notes },
    ],
    { tier: "fast", maxTokens: 1_200, responseFormat: { type: "json_object" }, ...(meta ? { meta: { ...meta, surface: "proposal_brief" } } : {}) },
  );
  return cleanBrief(parseJsonObject(result.text));
}

const PICK_SYSTEM = [
  "You find the past engagements of a consulting firm that are the best precedents for a new proposal.",
  `Return JSON only: {"precedents": [{"board_id": "<id>", "closeness": "close" | "loose", "why": "<at most twelve words>"}]}.`,
  `At most ${PRECEDENTS_MAX}. "close" means the same kind of work for a similar client; "loose" means related work that still teaches something.`,
  "Fewer is better than padding: an empty list is a valid answer. Never call a weak match close.",
].join("\n");

function boardCard(corpus: FirmCorpus, boardId: string): string {
  const board = corpus.boards.find((entry) => entry.id === boardId)!;
  const sow = corpus.items.find((item) => item.boardId === boardId && item.sowFacts);
  return [
    `BOARD ${board.id}: ${board.title}`,
    board.brief && `brief: ${maskFees(board.brief.replace(/\s+/g, " ").slice(0, 600))}`,
    sow?.summary && `scope: ${maskFees(sow.summary)}`,
    board.outcome && `outcome: ${maskFees(board.outcome)}`,
  ]
    .filter(Boolean)
    .join(" | ");
}

/** Picks from a reply cut off at its token limit: each complete board_id and closeness pair, in order. */
export function salvagePicks(text: string): { board_id: string; closeness: string; why: string }[] {
  const pattern = /"board_id"\s*:\s*"([^"]+)"\s*,\s*"closeness"\s*:\s*"(close|loose)"(?:\s*,\s*"why"\s*:\s*"([^"]*)")?/g;
  return [...text.matchAll(pattern)].map((match) => ({ board_id: match[1]!, closeness: match[2]!, why: match[3] ?? "" }));
}

export function buildPickMessages(corpus: FirmCorpus, brief: ProposalBrief): ChatMessage[] {
  const lines = PROPOSAL_BRIEF_FIELDS.map((field) => `${field}: ${brief[field]}`).join("\n");
  return [
    { role: "system", content: PICK_SYSTEM },
    { role: "user", content: `${corpus.boards.map((board) => boardCard(corpus, board.id)).join("\n")}\n\nNEW PROPOSAL BRIEF\n${lines}` },
  ];
}

export async function pickPrecedents(chat: Chat, corpus: FirmCorpus, brief: ProposalBrief, meta: ChatOptions["meta"]): Promise<ReturnType<typeof checkPicks>> {
  if (!corpus.boards.length) return [];
  const result = await chat(buildPickMessages(corpus, brief), {
    tier: "fast",
    maxTokens: 1_200,
    responseFormat: { type: "json_object" },
    ...(meta ? { meta: { ...meta, surface: "proposal_precedents" } } : {}),
  });
  const parsed = parseJsonObject(result.text)["precedents"];
  return checkPicks(Array.isArray(parsed) ? parsed : salvagePicks(result.text), corpus);
}
