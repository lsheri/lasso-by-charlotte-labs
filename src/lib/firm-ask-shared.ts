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
  title: "Ask the firm",
  hint: "Have we done this before, and what did we learn? Answers come only from work shared with the firm, and every line links to its source.",
  placeholder: "Have we worked on obesity care?",
  inputLabel: "Question for the firm",
  submit: "Ask",
  pending: "Reading work shared with the firm",
  error: "That did not work. Try again.",
  notFound: "Not found in work shared with the firm. Some engagements are not shared.",
  aboutPeople: "Ask the firm answers about work, not people. Here are the engagements that match.",
  oneSource: "This answer rests on one source.",
  nearest: "Nearest shared work",
  quoted: "Quoted",
  fromSummary: "From summary",
  shown: "Shown to client",
  readTitle: "What it read",
  readFull: "Read in full",
  readSummary: "Scanned by summary",
  weeks: (weeks: number) => `${weeks} weeks`,
  lead: (name: string) => `Led by ${name}`,
  previewSummary: "Only this summary is shared with the firm. The full note stays with the people on its board.",
  keepOut: "Keep this out of firm answers",
  keptOut: "Kept out. It will not appear in firm answers.",
  close: "Close",
  closeOut: "Close-out lesson",
} as const;

export const FIRM_ASK_STARTER_COPY: Record<FirmAskStarter, { label: string; stem: string }> = {
  similar: { label: "Similar engagements", stem: "Which past engagements are most like " },
  went_wrong: { label: "What went wrong last time", stem: "What went wrong on past engagements like " },
  charged: { label: "What we charged", stem: "What have we charged for work like " },
};

/** Starter chips this person sees: "What we charged" is for admins and leads only. */
export function startersFor(role: string | null | undefined): FirmAskStarter[] {
  const feeAccess = role === "admin" || role === "lead";
  return FIRM_ASK_STARTERS.filter((starter) => starter !== "charged" || feeAccess);
}

/** Who sees the box: the company-brain flag is on, the workspace is a company, and the person is not a coach. The server checks again. */
export function canAskTheFirm(flagOn: boolean, profile: { role?: string | null; has_firm_view?: boolean | null; org_type?: string | null } | null | undefined): boolean {
  if (!flagOn || !profile || profile.role === "coach") return false;
  return typeof profile.has_firm_view === "boolean" ? profile.has_firm_view : profile.org_type === "company";
}

export const FIRM_TYPE_LABELS: Record<string, string> = {
  document: "Document",
  deck: "Deck",
  sheet: "Sheet",
  call: "Call notes",
  ai_thread: "AI chat",
  email: "Email",
  image: "Image",
  outcome: "Close-out",
};

// Commas only as thousands separators, so "£340,000, €1.2M" stays two figures.
const NUMBER = "\\d+(?:,\\d{3})*(?:\\.\\d+)?";
const AMOUNT = `${NUMBER}(?:\\s*(?:k|m|bn|million|thousand)\\b)?`;
const CODES = "USD|GBP|EUR|AUD|CAD|NZD|CHF|SGD";
/**
 * A money figure in any form a firm writes one: a symbol ("$380k", "£340,000", "€1.2M"), a currency code
 * before or after ("USD 90,000", "380k GBP") or a word after ("45,000 dollars"). Exported so the draft's figure check
 * reads money the same way.
 */
export const MONEY_SOURCE = `(?:[$£€]\\s?${AMOUNT}|\\b(?:${CODES})\\s?${AMOUNT}|\\b${NUMBER}\\s?(?:k|m|bn|million|thousand)?\\s?(?:${CODES}|dollars|pounds|euros)\\b)`;
/** Any money figure, so the model never sees a fee: "$380k", "$45k/month", "£340,000", "USD 90,000". */
const MONEY = new RegExp(`${MONEY_SOURCE}(?:\\s*(?:\\/|per|a)\\s*month)?`, "gi");

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

const PEOPLE = "(?:person|people|consultants?|analysts?|partners?|leads?|associates?|managers?|staff|colleagues?|employees?|team members?|performers?)";
const PEOPLE_QUESTIONS = [
  // "Who is our best person for health work?", "Who's the strongest analyst?"
  /\bwho(?:'s|\s+is|\s+are|\s+was|\s+were)\b.*\b(?:best|worst|strongest|weakest|top|better|worse|most\s+(?:experienced|senior|skilled|productive|reliable)|least\s+\w+)\b/i,
  // "Rank our consultants", "compare the partners"
  new RegExp(`\\b(?:rank|rate|score|grade|compare|judge|evaluate)\\b.*\\b${PEOPLE}\\b`, "i"),
  // "our best consultant", "top performers"
  new RegExp(`\\b(?:best|worst|strongest|weakest|top|bottom|underperforming)\\s+${PEOPLE}\\b`, "i"),
  // "Who performs best?", "who delivers better"
  /\bwho\s+(?:performs|performed|delivers|delivered|underperforms)\b/i,
];

/**
 * A question that ranks, compares or judges people, caught in code before any model call so the refusal never
 * depends on what the model picks. The answer model's own flag stays as a second line for questions this misses.
 */
export function asksAboutPeople(question: string): boolean {
  return PEOPLE_QUESTIONS.some((pattern) => pattern.test(question));
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
  /** Labels for every item read, so the screen can show sources without another request. */
  sources: Record<string, FirmAskSource>;
  coverage: string;
  oneSource: boolean;
};

export type FirmAskSource = {
  title: string;
  type: string;
  date: string | null;
  boardId: string;
  boardTitle: string;
  /** The latest "Shown to client" date, if any. */
  shownOn: string | null;
};

/** Labels for the items read, from the corpus. */
/**
 * An engagement's close-out line (its outcome and lesson) as a source of its own, so a lesson can be picked and cited
 * like an item. Not an item id, so it never opens an item preview.
 */
export function outcomeSourceId(boardId: string): string {
  return `outcome-${boardId}`;
}

export function sourcesFor(corpus: FirmCorpus, itemIds: readonly string[]): Record<string, FirmAskSource> {
  const out: Record<string, FirmAskSource> = {};
  for (const id of itemIds) {
    const closed = corpus.boards.find((entry) => outcomeSourceId(entry.id) === id);
    if (closed) {
      out[id] = { title: FIRM_ASK_COPY.closeOut, type: "outcome", date: null, boardId: closed.id, boardTitle: closed.title, shownOn: null };
      continue;
    }
    const item = corpus.items.find((entry) => entry.id === id);
    const board = item && corpus.boards.find((entry) => entry.id === item.boardId);
    if (!item || !board) continue;
    out[id] = { title: item.title, type: item.type, date: item.date, boardId: board.id, boardTitle: board.title, shownOn: item.shown.at(-1)?.on ?? null };
  }
  return out;
}

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

/** "24 Jun 2025": past work needs its year. */
export function firmDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}
