/**
 * Ask the firm, server side: two model calls over what the firm reader serves (firm-brain-review RECOMMENDATION
 * section 3). Call A (fast) reads every board and item card and picks up to 12 items. Call B (smart) reads those
 * items, in full when the asker may quote them and as index cards otherwise, and answers as claims with quotes.
 * Code then keeps only claims whose quote it finds word for word. Nothing is stored: no index, no answers.
 *
 * The model never sees a fee: every text it reads has money figures masked, and the facts strip is built by code.
 * The call and the text loader are passed in, so the engine is tested without a model or a database.
 */

import type { ChatMessage, ChatOptions, ChatResult } from "@/lib/ai.server";
import { parseJsonObject } from "@/lib/span-provenance.server";

import { coverageLine, type FirmCorpus } from "./firm-corpus-shared";
import {
  asksAboutPeople,
  checkClaims,
  factsFor,
  FIRM_ASK_ITEM_CHARS,
  FIRM_ASK_PICK_MAX,
  FIRM_ASK_READ_MAX,
  holdsOpinion,
  maskFees,
  outcomeSourceId,
  sourcesFor,
  type FirmAskResult,
  type ReadSource,
} from "./firm-ask-shared";

export type FirmAskDeps = {
  chat: (messages: ChatMessage[], options: ChatOptions) => Promise<ChatResult>;
  /** The full text of an item the corpus lets the asker quote, or null. */
  loadText: (itemId: string) => Promise<string | null>;
};

export type FirmAskInput = {
  corpus: FirmCorpus;
  question: string;
  canSeeFees: boolean;
  meta: ChatOptions["meta"];
};

export type FirmAskUsage = { costUsd: number; tokensIn: number; tokensOut: number; calls: number };

const SELECT_SYSTEM = [
  "You pick which of a consulting firm's past work could answer a question.",
  "You are given board cards (one per engagement) and item cards (one per piece of work, under its board).",
  `Return JSON only, ids and nothing else: {"items": ["<item id>", "<item id>"]}.`,
  `Pick at most ${FIRM_ASK_PICK_MAX} items, most relevant first. Match on meaning, not only words: "obesity care" matches "weight management".`,
  "Each finished engagement has a CLOSE-OUT line with its own id: what happened and the lesson. Pick it when the question is about lessons, what went wrong or how work went.",
  'An item marked "proposal draft" is a proposal the firm is writing now. It counts as the firm\'s work on its topic: pick it when the question is about that topic, including "have we done X" and "have we worked on X".',
  'An empty list is a valid answer when nothing is relevant. Never pick something only loosely related to fill the list.',
].join("\n");

const ANSWER_SYSTEM = [
  "You answer a question about a consulting firm's past work, using only the documents given.",
  `Return JSON only: {"about_people": false, "not_found": false, "nearest": "", "claims": [{"text": "<one sentence>", "item_id": "<id>", "quote": "<words copied exactly from that document>"}], "summary": "<two sentences>"}.`,
  "RULES:",
  "- Every claim needs the id of the document it comes from and a quote copied word for word from that document, at least a few words long. A claim you cannot quote is not a claim.",
  "- Never state a fee, price or number of weeks. Code shows those. Money in the documents appears as [fee]; never repeat it.",
  "- Never repeat an opinion about a named or described person, even if a document holds one.",
  '- If the question asks to rank, count, compare or judge people ("who is best"), set "about_people" to true and make no claims.',
  '- If the documents do not answer the question, set "not_found" to true. You may put the nearest related work and how it differs in "nearest", in one sentence. Never present near work as a match.',
  '- A document of type "proposal draft" is a proposal the firm is writing, not delivered work. When it is on the topic of the question it is a match, not near work: make a claim from it, and say in that claim that it is a proposal draft. Never set "not_found" only because the matching work is a proposal draft.',
  `- At most 6 claims. The summary uses only what the claims say.`,
].join("\n");

/** How a saved proposal draft is named to both model calls. */
export const PROPOSAL_DRAFT_TYPE = "proposal draft";
/** What a claim from a proposal draft opens with when the model did not say it is one. */
export const PROPOSAL_DRAFT_LEAD = "Proposal draft, not delivered work: ";

function boardCard(corpus: FirmCorpus, boardId: string): string {
  const board = corpus.boards.find((entry) => entry.id === boardId)!;
  const brief = maskFees((board.brief ?? "").replace(/\s+/g, " ").slice(0, 600));
  const head = [`BOARD ${board.id}: ${board.title}${board.client ? ` (${board.client})` : ""}`, `started ${board.startedOn}`, brief && `brief: ${brief}`]
    .filter(Boolean)
    .join(" | ");
  return board.outcome ? `${head}\n  CLOSE-OUT ${outcomeSourceId(board.id)}: ${maskFees(board.outcome)}` : head;
}

function itemCard(item: FirmCorpus["items"][number]): string {
  // A saved draft has no summary card of its own: its gist stands in, so it can be found by topic and not only by title.
  const summary = item.summary ?? item.proposalDraft?.gist ?? null;
  const type = item.proposalDraft ? `${item.type}, ${PROPOSAL_DRAFT_TYPE}` : item.type;
  return [`  ITEM ${item.id} [${type}] ${item.title}`, item.date && `date ${item.date}`, summary && `summary: ${maskFees(summary)}`, item.decisions && `decisions: ${maskFees(item.decisions.replace(/\n/g, "; "))}`, item.entities && `about: ${item.entities}`]
    .filter(Boolean)
    .join(" | ");
}

export function buildSelectMessages(corpus: FirmCorpus, question: string): ChatMessage[] {
  const cards = corpus.boards.map((board) => [boardCard(corpus, board.id), ...corpus.items.filter((item) => item.boardId === board.id).map(itemCard)].join("\n"));
  return [
    { role: "system", content: SELECT_SYSTEM },
    { role: "user", content: `${cards.join("\n\n")}\n\nQUESTION: ${question}` },
  ];
}

export function buildAnswerMessages(corpus: FirmCorpus, question: string, read: readonly ReadSource[], retry: boolean): ChatMessage[] {
  const documents = read.map((source) => {
    const board = corpus.boards.find((entry) => entry.id === source.boardId)!;
    const item = corpus.items.find((entry) => entry.id === source.itemId);
    if (!item) return `<document id="${source.itemId}" board="${board.title}" type="close-out" read="document">\n${source.text}\n</document>`;
    const mark = item.shown.length ? ` | shown to client ${item.shown[item.shown.length - 1]!.on}` : "";
    const kind = source.grade === "full" ? "document" : "index card only";
    return `<document id="${source.itemId}" board="${board.title}" type="${item.proposalDraft ? PROPOSAL_DRAFT_TYPE : item.type}" date="${item.date ?? ""}"${mark ? ` mark="${mark.slice(3)}"` : ""} read="${kind}">\n${source.text}\n</document>`;
  });
  const list = read.map((source) => source.itemId).join(", ");
  const again = retry ? "\nYour last answer's quotes were not found in the documents. Copy each quote exactly, character for character.\n" : "";
  return [
    { role: "system", content: ANSWER_SYSTEM },
    { role: "user", content: `${documents.join("\n\n")}\n\nDocuments given: ${list}${again}\n\nQUESTION: ${question}` },
  ];
}

const UUID_IN_TEXT = /(?:outcome-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * The item ids call A picked, in order, known to the corpus. A reply cut off at its token limit is not valid JSON
 * (the first live run lost every answer that way), so ids are also recovered from the raw text.
 */
export function pickedIds(text: string, corpus: FirmCorpus): string[] {
  const known = new Set([...corpus.items.map((item) => item.id), ...corpus.boards.filter((board) => board.outcome).map((board) => outcomeSourceId(board.id))]);
  const raw = parseJsonObject(text);
  const list = Array.isArray(raw["items"]) ? raw["items"] : [];
  const parsed = list.map((entry) => (typeof entry === "string" ? entry : entry && typeof entry === "object" ? (entry as Record<string, unknown>)["id"] : null));
  const candidates = parsed.length ? parsed : (text.match(UUID_IN_TEXT) ?? []);
  const ids: string[] = [];
  for (const id of candidates) {
    if (typeof id === "string" && known.has(id) && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, FIRM_ASK_PICK_MAX);
}

async function readPicked(corpus: FirmCorpus, ids: readonly string[], loadText: FirmAskDeps["loadText"]): Promise<ReadSource[]> {
  const read: ReadSource[] = [];
  for (const id of ids.slice(0, FIRM_ASK_READ_MAX)) {
    const board = corpus.boards.find((entry) => outcomeSourceId(entry.id) === id);
    if (board?.outcome) {
      read.push({ itemId: id, boardId: board.id, grade: "full", text: maskFees(board.outcome) });
      continue;
    }
    const item = corpus.items.find((entry) => entry.id === id)!;
    if (item.grade === "full") {
      const text = await loadText(id);
      if (text) {
        read.push({ itemId: id, boardId: item.boardId, grade: "full", text: maskFees(text.slice(0, FIRM_ASK_ITEM_CHARS)) });
        continue;
      }
    }
    const card = [item.summary ?? item.proposalDraft?.gist, item.decisions].filter(Boolean).join("\n");
    if (card) read.push({ itemId: id, boardId: item.boardId, grade: "summary", text: maskFees(card) });
  }
  return read;
}

/**
 * A claim from a proposal draft always says so. The model is told to; where it did not, code opens the claim with it,
 * so a proposal in progress is never read as work the firm delivered.
 */
export function sayItIsADraft(corpus: FirmCorpus, claim: FirmAskResult["claims"][number]): FirmAskResult["claims"][number] {
  const item = corpus.items.find((entry) => entry.id === claim.itemId);
  if (!item?.proposalDraft || /\b(proposal|draft)\b/i.test(claim.text)) return claim;
  return { ...claim, text: `${PROPOSAL_DRAFT_LEAD}${claim.text}`.slice(0, 400) };
}

function empty(corpus: FirmCorpus, status: FirmAskResult["status"], read: readonly ReadSource[] = [], nearest: string | null = null): FirmAskResult {
  return {
    status,
    summary: null,
    claims: [],
    facts: [],
    nearest,
    read: { full: read.filter((source) => source.grade === "full").map((source) => source.itemId), summary: read.filter((source) => source.grade === "summary").map((source) => source.itemId) },
    sources: sourcesFor(corpus, read.map((source) => source.itemId)),
    coverage: coverageLine(corpus),
    oneSource: false,
  };
}

export async function runFirmAsk(deps: FirmAskDeps, input: FirmAskInput): Promise<{ result: FirmAskResult; usage: FirmAskUsage }> {
  const { corpus, question } = input;
  const usage: FirmAskUsage = { costUsd: 0, tokensIn: 0, tokensOut: 0, calls: 0 };
  const count = (result: ChatResult) => {
    usage.costUsd += result.costUsd;
    usage.tokensIn += result.tokensIn;
    usage.tokensOut += result.tokensOut;
    usage.calls += 1;
  };
  if (!corpus.items.length) return { result: empty(corpus, "not_found"), usage };

  const select = await deps.chat(buildSelectMessages(corpus, question), {
    tier: "fast",
    maxTokens: 1_500,
    responseFormat: { type: "json_object" },
    ...(input.meta ? { meta: { ...input.meta, surface: "firm_ask_select" } } : {}),
  });
  count(select);
  // A question about people is refused whatever the picking call finds; it still lists matching engagements.
  const aboutPeople = asksAboutPeople(question);
  const ids = pickedIds(select.text, corpus);
  if (!ids.length) return { result: empty(corpus, aboutPeople ? "about_people" : "not_found"), usage };

  const read = await readPicked(corpus, ids, deps.loadText);
  if (!read.length) return { result: empty(corpus, aboutPeople ? "about_people" : "not_found"), usage };
  if (aboutPeople) {
    const boards = [...new Set(read.map((source) => source.boardId))];
    return { result: { ...empty(corpus, "about_people", read), facts: factsFor(corpus, boards, input.canSeeFees) }, usage };
  }

  let parsed: Record<string, unknown> = {};
  let checked = { claims: [] as FirmAskResult["claims"], offered: 0 };
  for (const retry of [false, true]) {
    const answer = await deps.chat(buildAnswerMessages(corpus, question, read, retry), {
      tier: "smart",
      maxTokens: 2_000,
      responseFormat: { type: "json_object" },
      ...(input.meta ? { meta: { ...input.meta, surface: "firm_ask_answer" } } : {}),
    });
    count(answer);
    parsed = parseJsonObject(answer.text);
    checked = checkClaims(parsed["claims"], read);
    checked = { ...checked, claims: checked.claims.map((claim) => sayItIsADraft(corpus, claim)) };
    // Retry once only when the model offered claims and every quote failed.
    if (checked.claims.length || !checked.offered || parsed["about_people"] === true || parsed["not_found"] === true) break;
  }

  if (parsed["about_people"] === true) {
    const boards = [...new Set(read.map((source) => source.boardId))];
    return { result: { ...empty(corpus, "about_people", read), facts: factsFor(corpus, boards, input.canSeeFees) }, usage };
  }
  if (!checked.claims.length) {
    const raw = typeof parsed["nearest"] === "string" ? maskFees(parsed["nearest"].trim()).slice(0, 300) : "";
    const nearest = raw && !holdsOpinion(raw) && !raw.includes("[fee]") ? raw : null;
    return { result: empty(corpus, "not_found", read, nearest), usage };
  }

  // The summary is shown only when every claim the model made survived, so it cannot rest on a dropped one.
  const summaryText = typeof parsed["summary"] === "string" ? parsed["summary"].trim() : "";
  const summary = checked.claims.length === checked.offered && summaryText && !holdsOpinion(summaryText) && !/\$\s?\d|\[fee\]/.test(summaryText) ? summaryText.slice(0, 500) : null;
  const sources = new Set(checked.claims.map((claim) => claim.itemId));
  return {
    result: {
      ...empty(corpus, "answered", read),
      status: "answered",
      summary,
      claims: checked.claims,
      facts: factsFor(corpus, checked.claims.map((claim) => claim.boardId), input.canSeeFees),
      oneSource: sources.size === 1,
    },
    usage,
  };
}

