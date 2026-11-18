/**
 * Ask the firm: "Have we done this before, and what did we learn?" answered from work shared with the firm, with
 * proof (firm-brain-review RECOMMENDATION section 3). Pure parts, so the guarantees are tested without a model:
 * every shown claim carries a quote code found word for word in its source, the model never sees or types a fee,
 * no opinion about a person survives, and facts such as length and fees are rendered by code.
 */

import { containsVerbatim } from "@/lib/span-provenance-shared";

import type { FirmCorpus, FirmGrade } from "./firm-corpus-shared";

export const FIRM_ASK_QUESTION_MAX = 500;
/** Call A may pick this many items; call B reads at most FIRM_ASK_READ_MAX of them. */
export const FIRM_ASK_PICK_MAX = 12;
export const FIRM_ASK_READ_MAX = 10;
/** About 2,500 tokens per item read in full. */
export const FIRM_ASK_ITEM_CHARS = 10_000;
export const FIRM_ASK_CLAIMS_MAX = 6;

/** The starter chips under the box. The third shows only to people with fee access. */
export const FIRM_ASK_STARTERS = ["similar", "went_wrong", "charged"] as const;
export type FirmAskStarter = (typeof FIRM_ASK_STARTERS)[number];

export const FIRM_ASK_COPY = {
  notFound: "Not found in work shared with the firm. Some engagements are not shared.",
  aboutPeople: "Ask the firm answers about work, not people. Here are the engagements that match.",
  oneSource: "This answer rests on one source.",
} as const;

/** Any money figure, so the model never sees a fee: "$380k", "$380,000", "$45k/month", "$1.2M". */
const MONEY = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|bn|million|thousand)\b)?(?:\s*(?:\/|per|a)\s*month)?/gi;

const HAS_MONEY = new RegExp(MONEY.source, "i");

export function maskFees(text: string): string {
  return text.replace(MONEY, "[fee]");
}

/**
 * Words that mark an opinion about a person. Crude on purpose: a second line behind the prompt's rule, it drops any
 * claim using one, even when the opinion is about a process.
 */
export const OPINION_WORDS = [
  "difficult",
  "stall",
  "stalls",
  "oversell",
  "oversells",
  "backs away",
  "incompetent",
  "lazy",
  "useless",
  "hostile",
  "abrasive",
  "toxic",
  "nightmare",
  "do not get on",
] as const;

export function holdsOpinion(text: string): boolean {
  const lower = text.toLowerCase();
  return OPINION_WORDS.some((word) => new RegExp(`\\b${word.replace(/\s+/g, "\\s+")}\\b`).test(lower));
}

export type FirmAskClaim = {
  text: string;
  itemId: string;
  boardId: string;
  quote: string;
  /** Quoted: found word for word in the item. From summary: found in its index card, body never read. */
  grade: "quoted" | "from_summary";
};

export type FirmAskFacts = {
  boardId: string;
  title: string;
  client: string | null;
  lead: string | null;
  weeks: number | null;
  outcome: string | null;
  /** As written in the SOW. Only for people with fee access. */
  fee: string | null;
};

export type FirmAskResult = {
  status: "answered" | "not_found" | "about_people";
  summary: string | null;
  claims: FirmAskClaim[];
  facts: FirmAskFacts[];
  /** Nearest shared work when nothing matched, in one line, or null. */
  nearest: string | null;
  read: { full: string[]; summary: string[] };
  coverage: string;
  oneSource: boolean;
};

/** What call B saw of one item: masked text for full reads, the index card for summary-only items. */
export type ReadSource = { itemId: string; boardId: string; grade: FirmGrade; text: string };

/**
 * Keeps only claims that hold up: the item was read, the quote is found word for word in what was read (masked text
 * or index card), and neither the claim nor the quote holds a money figure or an opinion about a person.
 */
export function checkClaims(raw: unknown, read: readonly ReadSource[]): { claims: FirmAskClaim[]; offered: number } {
  const list = Array.isArray(raw) ? raw : [];
  const byId = new Map(read.map((source) => [source.itemId, source]));
  const claims: FirmAskClaim[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const { text, item_id, quote } = entry as Record<string, unknown>;
    if (typeof text !== "string" || typeof item_id !== "string" || typeof quote !== "string") continue;
    const source = byId.get(item_id);
    if (!source || !containsVerbatim(source.text, quote)) continue;
    const said = `${text} ${quote}`;
    if (HAS_MONEY.test(said) || said.includes("[fee]") || holdsOpinion(said)) continue;
    claims.push({
      text: text.trim().slice(0, 400),
      itemId: source.itemId,
      boardId: source.boardId,
      quote: quote.trim().slice(0, 400),
      grade: source.grade === "full" ? "quoted" : "from_summary",
    });
    if (claims.length >= FIRM_ASK_CLAIMS_MAX) break;
  }
  return { claims, offered: list.length };
}

/** The facts strip for each board an answer cites, from data only. Fees only for people with fee access. */
export function factsFor(corpus: FirmCorpus, boardIds: readonly string[], canSeeFees: boolean): FirmAskFacts[] {
  return [...new Set(boardIds)].flatMap((boardId) => {
    const board = corpus.boards.find((entry) => entry.id === boardId);
    if (!board) return [];
    const sow = corpus.items.find((item) => item.boardId === boardId && item.sowFacts)?.sowFacts ?? null;
    const weeks = typeof sow?.["weeks"] === "number" ? sow["weeks"] : null;
    const fee = canSeeFees && typeof sow?.["fee_text"] === "string" ? sow["fee_text"] : null;
    return [{ boardId, title: board.title, client: board.client, lead: board.lead, weeks, outcome: board.outcome, fee }];
  });
}
