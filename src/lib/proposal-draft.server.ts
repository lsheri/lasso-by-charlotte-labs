/**
 * Start a proposal, step 2, server side. One smart-tier call writes the sections from the firm's own structure:
 * a masked exemplar proposal, up to three masked precedent packs, then the new client's notes, fenced and last. Code
 * then checks names (one redraft of any section that names another client, else it becomes a gap), quotes and
 * figures; one fast-tier call lists sentences about the new client the notes do not state. The model never reads a
 * fee or another client's name. The call is passed in, so this is tested without a model or a database.
 */

import type { ChatMessage, ChatOptions, ChatResult } from "@/lib/ai.server";
import { parseJsonObject } from "@/lib/span-provenance.server";

import { maskFees } from "./firm-ask-shared";
import { withoutFees, type FirmCorpus } from "./firm-corpus-shared";
import { parseOutcome, PROPOSAL_BRIEF_FIELDS, type ProposalBrief } from "./proposal-shared";
import {
  blockSection,
  clientVariants,
  forbiddenNames,
  markNewFacts,
  maskNames,
  MODEL_SECTIONS,
  namedSections,
  parseDraft,
  PROPOSAL_SECTIONS,
  QUESTIONS_MAX,
  QUESTIONS_MIN,
  type DraftContext,
  type DraftSection,
  type NameTerm,
  type ProposalDraft,
} from "./proposal-draft-shared";

type Chat = (messages: ChatMessage[], options: ChatOptions) => Promise<ChatResult>;

export const EXEMPLAR_CHARS = 12_000;
export const PACK_CHARS = 16_000;
export const INTAKE_CHARS = 24_000;
const DELIVERABLES_PER_PACK = 4;

export type DraftUsage = { costUsd: number; tokensIn: number; tokensOut: number; calls: number };

export type Pack = { boardId: string; title: string; text: string };

/** Reads an item's full text when the firm reader allows it; null otherwise. */
export type ReadItem = (itemId: string) => Promise<string | null>;

/**
 * One precedent as the model reads it: facts, the SOW body with fee and names masked, the outcome and lesson, and
 * titles and summaries of up to four client-shown deliverables. Never a fee.
 */
export async function buildPack(corpus: FirmCorpus, boardId: string, letter: string, terms: readonly NameTerm[], read: ReadItem): Promise<{ pack: Pack; quotable: [string, { title: string; text: string }][] } | null> {
  const board = corpus.boards.find((entry) => entry.id === boardId);
  if (!board) return null;
  const sow = corpus.items.find((item) => item.boardId === boardId && item.sowFacts);
  const weeks = typeof sow?.sowFacts?.["weeks"] === "number" ? `${sow.sowFacts["weeks"]} weeks` : "length not stated";
  const outcome = parseOutcome(board.outcome);
  const quotable: [string, { title: string; text: string }][] = [];
  const mask = (text: string) => maskNames(maskFees(text), terms);
  let sowText = "";
  if (sow) {
    const raw = await read(sow.id);
    if (raw) {
      sowText = mask(withoutFees(raw)).slice(0, PACK_CHARS / 2);
      quotable.push([sow.id, { title: mask(sow.title), text: sowText }]);
    }
  }
  const shown = corpus.items.filter((item) => item.boardId === boardId && item.shown.length > 0 && item.id !== sow?.id).slice(0, DELIVERABLES_PER_PACK);
  const lines = [
    `PRECEDENT ${letter} (board_id ${board.id}): ${mask(board.title)}`,
    `facts: client type ${board.client ? `[CLIENT ${letter}]` : "internal"}; ${weeks}; ${board.outcome ? "finished" : "still running"}${outcome.ranToPlan === null ? "" : outcome.ranToPlan ? "; ran to plan" : "; overran"}${outcome.extended ? "; client extended" : ""}`,
    outcome.lesson ? `lesson: ${mask(outcome.lesson)}` : "",
    sow ? `SOW (item_id ${sow.id}):\n${sowText || mask(sow.summary ?? "")}` : "",
    ...shown.map((item) => `deliverable shown to client: ${mask(item.title)}${item.summary ? `: ${mask(item.summary)}` : ""}`),
  ];
  return { pack: { boardId, title: board.title, text: lines.filter(Boolean).join("\n").slice(0, PACK_CHARS) }, quotable };
}

/** The firm's own client-shown proposal closest to the precedents, fee withheld and names masked. */
export async function buildExemplar(corpus: FirmCorpus, precedentIds: readonly string[], terms: readonly NameTerm[], read: ReadItem): Promise<string | null> {
  const proposals = corpus.items
    .filter((item) => item.kind === "proposal" && item.shown.length > 0 && item.grade === "full")
    .sort((a, b) => {
      const rank = (id: string) => (precedentIds.includes(id) ? precedentIds.indexOf(id) : precedentIds.length);
      return rank(a.boardId) - rank(b.boardId) || (b.shown.at(-1)!.on ?? "").localeCompare(a.shown.at(-1)!.on ?? "");
    });
  const pick = proposals[0];
  if (!pick) return null;
  const text = await read(pick.id);
  if (!text) return null;
  // The exemplar's own client is masked too, even when it is not a precedent.
  const own = corpus.boards.find((board) => board.id === pick.boardId)?.client;
  const extra: NameTerm[] = own ? clientVariants(own).map((term) => ({ term, replacement: "[CLIENT]" })) : [];
  return maskNames(maskFees(withoutFees(text)), [...extra, ...terms]).slice(0, EXEMPLAR_CHARS);
}

const DRAFT_SYSTEM = `You write the first draft of a consulting proposal in this firm's own structure.

You are given: an EXEMPLAR proposal this firm showed a client (names masked), PRECEDENT packs from past engagements (names masked), and the NEW CLIENT block: the intake notes and a short brief for the proposal being written.

Return STRICT JSON and nothing else:
{
  "sections": {
    ${MODEL_SECTIONS.map((key) => `"${key}": { "body": string, "gap": boolean, "sources": [ { "board_id": string } | { "item_id": string, "quote": string } ] }`).join(",\n    ")}
  },
  "team_roles": [string],
  "questions": [ { "question": string, "default": string } ]
}

RULES:
- Facts about the new client come ONLY from the NEW CLIENT block. A precedent's facts are never facts about the new client.
- Borrow structure from precedents and the exemplar: phases, workstreams, deliverables, timeline shape. Cite borrowed structure as { "board_id": "<the precedent's board_id>" }.
- A stated fact cites the item it came from as { "item_id", "quote" }, with the quote copied character for character from that item.
- approach is a structured outline, not prose: one line per phase, then its activities and deliverables as short dashes. The lead fills it in.
- Put each precedent's lesson into assumptions and exclusions where it applies, citing that precedent's board_id.
- Where nothing supports a section, set "gap": true and leave body empty. Never guess.
- Never write a fee, a price, a rate or any money figure. Never name a person. Never write another client's name; write about the new client as "the client".
- team_roles: role labels only, for example "Engagement lead". No names.
- questions: ${QUESTIONS_MIN} to ${QUESTIONS_MAX} closed questions for the engagement lead. Each names a scope item, a number or a role, and carries a default taken from a precedent, for example "Interview count?" with default "20 to 25, as on a past engagement". Where a precedent went badly, the question carries its lesson.
- Plain words. No em dashes.`;

export function buildDraftMessages(input: { exemplar: string | null; packs: Pack[]; intake: string; brief: ProposalBrief }): ChatMessage[] {
  const brief = PROPOSAL_BRIEF_FIELDS.map((field) => `${field}: ${input.brief[field]}`).join("\n");
  const user = [
    input.exemplar ? `EXEMPLAR\n${input.exemplar}` : "EXEMPLAR\n(none: this firm has no client-shown proposal shared with the firm yet)",
    input.packs.length ? input.packs.map((pack) => pack.text).join("\n\n") : "PRECEDENTS\n(none chosen)",
    `=== NEW CLIENT (the only source of facts about this client) ===\nBRIEF\n${brief}\n\nNOTES\n${input.intake.slice(0, INTAKE_CHARS)}\n=== END NEW CLIENT ===`,
    "Write the sections, cite them, and end with the questions for the lead.",
  ].join("\n\n");
  return [
    { role: "system", content: DRAFT_SYSTEM },
    { role: "user", content: user },
  ];
}

const REDRAFT_SYSTEM = `You rewrite sections of a proposal draft that named another client. Keep the meaning and structure; refer to the new client only as "the client" and never name any other organisation or person. Return STRICT JSON: { "sections": { "<key>": { "body": string } } } with exactly the keys given. No em dashes.`;

const FACTS_SYSTEM = `You check a proposal draft against the intake notes for its client. List every sentence in the draft that states a fact about this client (its size, situation, numbers, people, history, or what it asked for) that the notes do not state. Sentences about the firm's approach, plans or assumptions are not facts about the client. Return JSON only: { "sentences": [string] }, each copied exactly from the draft. An empty list is a valid answer.`;

export async function runProposalDraft(
  chat: Chat,
  input: { corpus: FirmCorpus; precedentIds: string[]; intake: string; brief: ProposalBrief; ownItems: Map<string, { title: string; text: string }>; read: ReadItem; meta: ChatOptions["meta"]; now?: Date },
): Promise<{ draft: ProposalDraft; usage: DraftUsage }> {
  const usage: DraftUsage = { costUsd: 0, tokensIn: 0, tokensOut: 0, calls: 0 };
  const count = (result: ChatResult) => {
    usage.costUsd += result.costUsd;
    usage.tokensIn += result.tokensIn;
    usage.tokensOut += result.tokensOut;
    usage.calls += 1;
  };
  const withMeta = (surface: string) => (input.meta ? { meta: { ...input.meta, surface } } : {});
  const intake = maskFees(input.intake);
  const terms = forbiddenNames(input.corpus, input.precedentIds, intake);

  const packs: Pack[] = [];
  const quotable = new Map(input.ownItems);
  for (const [index, boardId] of input.precedentIds.entries()) {
    const built = await buildPack(input.corpus, boardId, String.fromCharCode(65 + index), terms, input.read);
    if (!built) continue;
    packs.push(built.pack);
    for (const [id, item] of built.quotable) quotable.set(id, item);
  }
  const exemplar = await buildExemplar(input.corpus, input.precedentIds, terms, input.read);
  const ctx: DraftContext = { precedents: packs.map((pack) => ({ boardId: pack.boardId, title: pack.title })), quotable, intake, terms };

  const first = await chat(buildDraftMessages({ exemplar, packs, intake, brief: input.brief }), {
    tier: "smart",
    maxTokens: 3_500,
    responseFormat: { type: "json_object" },
    ...withMeta("proposal_draft"),
  });
  count(first);
  const raw = parseJsonObject(first.text);
  const parsed = parseDraft(raw, ctx);
  let sections: DraftSection[] = parsed.sections;
  let names: ProposalDraft["checks"]["names"] = "passed";
  let blocked = 0;

  const named = namedSections(sections, terms);
  if (named.length) {
    names = "redrafted";
    const redraft = await chat(
      [
        { role: "system", content: REDRAFT_SYSTEM },
        { role: "user", content: JSON.stringify({ sections: Object.fromEntries(named.map((key) => [key, { body: sections.find((section) => section.key === key)!.body }])) }) },
      ],
      { tier: "smart", maxTokens: 2_000, responseFormat: { type: "json_object" }, ...withMeta("proposal_redraft") },
    );
    count(redraft);
    const rewritten = parseJsonObject(redraft.text)["sections"];
    const given = rewritten && typeof rewritten === "object" ? (rewritten as Record<string, { body?: unknown }>) : {};
    const redone = parseDraft({ sections: Object.fromEntries(named.map((key) => [key, { body: given[key]?.body, sources: (raw["sections"] as Record<string, { sources?: unknown }> | undefined)?.[key]?.sources }])) }, ctx);
    sections = sections.map((section) => {
      if (!named.includes(section.key)) return section;
      const next = redone.sections.find((entry) => entry.key === section.key)!;
      if (next.status === "gap" || namedSections([next], terms).length) {
        blocked += 1;
        return blockSection(section);
      }
      return next;
    });
    if (blocked) names = "blocked";
  }

  const facts = await chat(
    [
      { role: "system", content: FACTS_SYSTEM },
      { role: "user", content: `NOTES\n${intake.slice(0, INTAKE_CHARS)}\n\nDRAFT\n${sections.filter((section) => section.status !== "gap").map((section) => `${section.heading}\n${section.body}`).join("\n\n")}` },
    ],
    { tier: "fast", maxTokens: 1_200, responseFormat: { type: "json_object" }, ...withMeta("proposal_new_facts") },
  );
  count(facts);
  const listed = parseJsonObject(facts.text)["sentences"];
  const marked = markNewFacts(sections, Array.isArray(listed) ? listed.filter((entry): entry is string => typeof entry === "string") : []);

  return {
    draft: {
      sections: marked.sections,
      questions: parsed.questions,
      checks: { names, blocked, figuresRemoved: parsed.figuresRemoved, newFacts: marked.count },
      precedentIds: packs.map((pack) => pack.boardId),
      createdAt: (input.now ?? new Date()).toISOString(),
    },
    usage,
  };
}

/** Every section key, for callers that confirm one. */
export const SECTION_KEYS = new Set<string>(PROPOSAL_SECTIONS.map((section) => section.key));
