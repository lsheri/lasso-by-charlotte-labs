/**
 * The walk-through (Firm Brain Build Spec: Threads and Walk-throughs, step 6): "how we do this" for one situation or
 * method, as three to five habits in plain words, each with a quote from past work, then up to four examples to read.
 * Pure parts, so every guarantee is tested without a model or a database:
 *
 * - Code picks the work by tag. The model is never asked what is relevant and never sees a question.
 * - A habit is shown only when code finds one of its quotes word for word in a source this asker may read.
 * - No habit names a person at the firm, holds a money figure or an opinion about a person.
 * - A call reaches people who are not on its board as its stored summary only.
 * - Fewer than three engagements on the tag means no model call and no habits, said plainly, every time.
 * - Nothing is stored: it is built from the firm reader's live rows on every request.
 */

import {
  METHOD_LABELS,
  METHODS,
  SITUATION_LABELS,
  SITUATIONS,
  type Method,
  type Situation,
} from "./engagement-tags";
import {
  FIRM_TYPE_LABELS,
  holdsOpinion,
  maskFees,
  MONEY_SOURCE,
  type FirmAskSource,
} from "./firm-ask-shared";
import type { FirmBoard, FirmCorpus, FirmGrade, FirmItem } from "./firm-corpus-shared";
import { assembleFirmGraph } from "./firm-graph-shared";

/** Below this many engagements a pattern is not a habit, so none is written. */
export const WALK_MIN_ENGAGEMENTS = 3;
export const WALK_HABITS_MAX = 5;
export const WALK_EXAMPLES_MAX = 4;
/** Items the model reads, spread across engagements. */
export const WALK_READ_MAX = 10;
/** About 1,250 tokens per item read in full. */
export const WALK_ITEM_CHARS = 5_000;
export const WALK_HABIT_CHARS = 240;
export const WALK_QUOTE_CHARS = 400;
/** A quote shorter than this proves nothing. */
export const WALK_QUOTE_MIN_CHARS = 12;
export const WALK_QUOTES_PER_HABIT = 2;

export type WalkKind = "situation" | "method";
export type WalkTag = { kind: "situation"; tag: Situation } | { kind: "method"; tag: Method };

export const FIRM_WALK_COPY = {
  open: "How we do this",
  again: "Write it again",
  pending: "Reading past work shared with the firm",
  error: "The walk-through could not be written. Try again.",
  habitsTitle: "How we do this",
  examplesTitle: "Examples to read",
  thin: (count: number) =>
    count === 0
      ? "No engagement shared with the firm has work on this yet, so there are no habits to show."
      : `Only ${count} ${count === 1 ? "engagement" : "engagements"} shared with the firm ${count === 1 ? "has" : "have"} work on this. That is too few to call anything a habit, so here ${count === 1 ? "is an example" : "are examples"} to read instead.`,
  none: "No habit could be backed word for word by past work this time. Here are examples to read instead.",
  noExamples: "There is nothing to read on this yet.",
  fromSummary: "From the stored summary",
  generated: "Written fresh each time from work shared with the firm. Nothing is saved.",
  openExample: (title: string) => `Open ${title}`,
} as const;

/** The tag a walk-through is about, or null: an unknown value and "other" have no walk-through. */
export function parseWalkTag(kind: unknown, tag: unknown): WalkTag | null {
  if (typeof tag !== "string" || tag === "other") return null;
  if (kind === "situation" && (SITUATIONS as readonly string[]).includes(tag))
    return { kind, tag: tag as Situation };
  if (kind === "method" && (METHODS as readonly string[]).includes(tag))
    return { kind, tag: tag as Method };
  return null;
}

/** The tag behind a map point (`situation:<tag>` or `method:<tag>`), or null for lessons, decks and threads. */
export function walkTagOfNode(nodeId: string | null | undefined): WalkTag | null {
  if (!nodeId) return null;
  const at = nodeId.indexOf(":");
  return at < 0 ? null : parseWalkTag(nodeId.slice(0, at), nodeId.slice(at + 1));
}

export function walkLabel(tag: WalkTag): string {
  return tag.kind === "situation" ? SITUATION_LABELS[tag.tag] : METHOD_LABELS[tag.tag];
}

/** Liam, 18 Nov: review notes do not feed walk-throughs. They carry no tag of their own, so they are told by title. */
export function isReviewNote(item: Pick<FirmItem, "title">): boolean {
  return /\breview(?:er)?(?:'s)?\s+(?:notes?|comments?)\b|\bred\s?pen\b/i.test(item.title);
}

/**
 * Work that can feed a walk-through: it says how it was done (a method tag) and is not scope or admin paper. SOWs and
 * proposals are where fees live, so they are out whatever their tags say.
 */
function feeds(item: FirmItem): boolean {
  return (
    (item.methods ?? []).length > 0 &&
    !item.sowFacts &&
    item.kind !== "proposal" &&
    !isReviewNote(item)
  );
}

export type WalkScope = {
  /** Engagements with work on the tag, newest first. */
  boards: FirmBoard[];
  /** That work, in no promised order. */
  items: FirmItem[];
};

/**
 * The work on one tag, chosen by code alone. A method takes every item tagged with it; a situation takes the tagged
 * work on every engagement that faced it (the same reading of "situation" as the map). Only the corpus is read, so an
 * unshared board, a private note or an Out item can never be in scope or be counted.
 */
export function walkScope(corpus: FirmCorpus, tag: WalkTag): WalkScope {
  const known = new Map(corpus.boards.map((board) => [board.id, board]));
  let items: FirmItem[];
  if (tag.kind === "method") {
    items = corpus.items.filter((item) => feeds(item) && (item.methods ?? []).includes(tag.tag));
  } else {
    const facing = new Set(
      assembleFirmGraph(corpus)
        .threads.filter((thread) => thread.situation === tag.tag)
        .map((thread) => thread.id),
    );
    items = corpus.items.filter((item) => feeds(item) && facing.has(item.boardId));
  }
  items = items.filter((item) => known.has(item.boardId));
  const used = new Set(items.map((item) => item.boardId));
  const boards = corpus.boards
    .filter((board) => used.has(board.id))
    .sort((a, b) => b.startedOn.localeCompare(a.startedOn) || a.id.localeCompare(b.id));
  return { boards, items };
}

const TYPE_ORDER = ["deck", "document", "sheet", "call", "ai_thread"];
const typeRank = (type: string) => {
  const at = TYPE_ORDER.indexOf(type);
  return at < 0 ? TYPE_ORDER.length : at;
};

const wasShown = (item: FirmItem) => item.shown.length > 0 || item.stage === "shown_to_client";

/**
 * Best first within one engagement: what the client saw, then finished work before drafts, then deliverables before
 * calls and chats, then newest.
 */
function byWorth(a: FirmItem, b: FirmItem): number {
  const shown = Number(wasShown(b)) - Number(wasShown(a));
  if (shown) return shown;
  const draft = Number(a.stage === "draft") - Number(b.stage === "draft");
  if (draft) return draft;
  const type = typeRank(a.type) - typeRank(b.type);
  if (type) return type;
  const date = (b.date ?? "").localeCompare(a.date ?? "");
  return date || a.id.localeCompare(b.id);
}

/**
 * Up to `max` items spread across engagements: the best item of each engagement, newest engagement first, then the
 * second best of each, and so on. The same scope always gives the same list.
 */
export function spreadAcross(scope: WalkScope, max: number): FirmItem[] {
  const queues = scope.boards.map((board) =>
    scope.items.filter((item) => item.boardId === board.id).sort(byWorth),
  );
  const out: FirmItem[] = [];
  for (
    let round = 0;
    out.length < max && queues.some((queue) => queue.length > round);
    round += 1
  ) {
    for (const queue of queues) {
      const item = queue[round];
      if (item && out.length < max) out.push(item);
    }
  }
  return out;
}

/**
 * How this asker may read one item in a walk-through. A call is its stored summary to everyone who is not on its
 * board, whatever its firm memory setting says (Liam, 18 Nov: call content is summary only firm-wide).
 */
export function walkGrade(
  item: Pick<FirmItem, "type" | "grade">,
  board: Pick<FirmBoard, "askerIsOnBoard">,
): FirmGrade {
  if (item.type === "call" && !board.askerIsOnBoard) return "summary";
  return item.grade;
}

/** What the model saw of one item, and what its quotes are checked against. */
export type WalkRead = { itemId: string; boardId: string; grade: FirmGrade; text: string };

/** Text as the model sees it: fees masked, and nothing that could close the document wrapper early. */
export function walkText(text: string): string {
  return maskFees(text.slice(0, WALK_ITEM_CHARS)).replace(/<\/?document/gi, "document");
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/** Word for word: the same characters in the same order, allowing only for line breaks and runs of spaces. */
export function quotedWordForWord(source: string, quote: string): boolean {
  const needle = collapse(quote);
  return needle.length >= WALK_QUOTE_MIN_CHARS && collapse(source).includes(needle);
}

const BARE_AMOUNT = "\\b\\d[\\d,.]*\\s?(?:k|m|bn|million|thousand)\\b";
const HAS_MONEY = new RegExp(
  [
    MONEY_SOURCE,
    "[$£€¥]",
    "\\[fee\\]",
    BARE_AMOUNT,
    "\\bplus\\s+expenses\\b",
    "\\b(?:fees?|priced?|retainer|day\\s+rate)\\s+(?:of|at|was|is|were)\\s+\\S*\\d",
  ].join("|"),
  "i",
);

/**
 * A money figure in any form, read more widely than Ask the firm's mask: a bare "380k", a lone currency sign, a
 * masked "[fee]", "plus expenses" and "fee of 90". A walk-through shows no money to anyone, so nothing depends on who
 * is asking.
 */
export function mentionsMoney(text: string): boolean {
  return HAS_MONEY.test(text);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A whole word, in any script: accented and hyphenated names have no ASCII word boundary. */
const asWord = (source: string, flags: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${source}(?![\\p{L}\\p{N}])`, `u${flags}`);

const CALENDAR = [
  ..."january february march april may june july august september october november december".split(
    " ",
  ),
  ..."monday tuesday wednesday thursday friday saturday sunday".split(" "),
];
const DATE_LEAD =
  "in|by|of|from|until|till|since|before|after|during|early|late|mid|the|last|next|this|each|every|and|or|to|through|on|between|around";

/** The text without a month or weekday used as a date ("10 June", "in June", "June 2025", "the June board"). */
function withoutDates(text: string, word: string): string {
  const w = escapeRegExp(word);
  return text
    .replace(new RegExp(`\\b${w}\\b(?=,?\\s+\\d)`, "gi"), " ")
    .replace(
      new RegExp(`(?:\\d{1,2}(?:st|nd|rd|th)?\\s+|\\b(?:${DATE_LEAD})[\\s-]+)${w}\\b`, "gi"),
      " ",
    );
}

/**
 * Does the text name someone at the firm? A full name in any case, or any part of a name of three letters or more
 * written as a name is written (a capital first letter, or all capitals), so "Mark" is caught and "mark" is not.
 * A first name that is also a month or a weekday is not counted where it is plainly a date, so a colleague called
 * June does not remove every sentence dated in June; "Ask June" and "June's notes" are still caught.
 */
export function namesStaff(text: string, people: readonly string[]): boolean {
  for (const person of people) {
    const name = collapse(person ?? "");
    if (name.length < 2) continue;
    if (asWord(escapeRegExp(name).replace(/ /g, "\\s+"), "i").test(text)) return true;
    for (const part of name.split(/[\s-]+/)) {
      if (part.length < 3) continue;
      const proper = part[0]!.toUpperCase() + part.slice(1);
      const within = CALENDAR.includes(part.toLowerCase()) ? withoutDates(text, part) : text;
      if (
        asWord(escapeRegExp(proper), "").test(within) ||
        asWord(escapeRegExp(part.toUpperCase()), "").test(within)
      )
        return true;
    }
  }
  return false;
}

/** A person addressed by title ("Dr. Okafor", "Ms Lee"): a client's people are not in the firm's list. */
const TITLED_PERSON = /\b(?:Dr|Mr|Mrs|Ms|Mx|Prof|Professor)\.?\s+\p{Lu}/u;

const numbersIn = (text: string) => text.match(/\d+(?:[.,]\d+)*/g) ?? [];

function namesClient(text: string, clients: readonly string[]): boolean {
  return clients.some((client) => {
    const name = collapse(client);
    return name.length >= 3 && asWord(escapeRegExp(name).replace(/ /g, "\\s+"), "i").test(text);
  });
}

export type WalkQuote = {
  itemId: string;
  boardId: string;
  quote: string;
  grade: "quoted" | "from_summary";
};
export type WalkHabit = { text: string; quotes: WalkQuote[] };

export type WalkExample = {
  itemId: string;
  title: string;
  type: string;
  /** Always set: the item's own date, or the day its engagement started. */
  date: string;
  boardId: string;
  /** The engagement's name: its client, or its title for a board with no client. */
  engagement: string;
  boardTitle: string;
};

export type FirmWalkthroughResult = {
  /**
   * habits: at least one habit held. thin: fewer than three engagements, so examples only and no model call.
   * none: the model offered nothing code could verify, so examples only.
   */
  status: "habits" | "thin" | "none";
  kind: WalkKind;
  tag: string;
  label: string;
  /** Engagements shared with the firm that have work on this tag. */
  engagements: number;
  habits: WalkHabit[];
  examples: WalkExample[];
  /** Labels for every source a habit quotes. */
  sources: Record<string, FirmAskSource>;
  coverage: string;
};

/** An item's title, unless it names someone at the firm or holds money: then the kind of thing it is. */
export function safeTitle(
  item: Pick<FirmItem, "title" | "type">,
  people: readonly string[],
): string {
  const title = collapse(item.title).slice(0, 160);
  if (!title || namesStaff(title, people) || mentionsMoney(title))
    return FIRM_TYPE_LABELS[item.type] ?? "Work";
  return title;
}

/** The examples to read: the best piece of work from each engagement, newest first, each with its engagement and date. */
export function walkExamples(
  corpus: FirmCorpus,
  scope: WalkScope,
  people: readonly string[],
): WalkExample[] {
  const boards = new Map(corpus.boards.map((board) => [board.id, board]));
  return spreadAcross(scope, WALK_EXAMPLES_MAX).map((item) => {
    const board = boards.get(item.boardId)!;
    return {
      itemId: item.id,
      title: safeTitle(item, people),
      type: item.type,
      date: item.date ?? board.startedOn,
      boardId: board.id,
      engagement: board.client?.trim() || board.title,
      boardTitle: board.title,
    };
  });
}

/** The source label under a habit's quote, with the same title rule as the examples. */
export function walkSources(
  corpus: FirmCorpus,
  itemIds: readonly string[],
  people: readonly string[],
): Record<string, FirmAskSource> {
  const out: Record<string, FirmAskSource> = {};
  for (const id of itemIds) {
    const item = corpus.items.find((entry) => entry.id === id);
    const board = item && corpus.boards.find((entry) => entry.id === item.boardId);
    if (!item || !board) continue;
    out[id] = {
      title: safeTitle(item, people),
      type: item.type,
      date: item.date ?? board.startedOn,
      boardId: board.id,
      boardTitle: board.title,
      shownOn: item.shown.at(-1)?.on ?? null,
    };
  }
  return out;
}

/**
 * Habit objects out of a model reply, whatever state it arrived in. A whole reply is read as JSON. A reply cut off at
 * its token limit is not valid JSON, so every complete `{"text": ...}` object before the cut is recovered instead.
 */
export function habitsFromReply(text: string): unknown[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const whole = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      if (Array.isArray(whole?.["habits"])) return whole["habits"];
    } catch {
      // Not whole: fall through and recover what is complete.
    }
  }
  const list = cleaned.indexOf("[", cleaned.indexOf('"habits"'));
  if (cleaned.indexOf('"habits"') < 0 || list < 0) return [];
  const out: unknown[] = [];
  let depth = 0;
  let from = -1;
  let inString = false;
  for (let i = list + 1; i < cleaned.length; i += 1) {
    const char = cleaned[i]!;
    if (inString) {
      if (char === "\\") i += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") {
      if (depth === 0) from = i;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && from >= 0) {
        try {
          out.push(JSON.parse(cleaned.slice(from, i + 1)));
        } catch {
          // A broken object is skipped; the ones around it still count.
        }
        from = -1;
      }
    } else if (char === "]" && depth === 0) break;
  }
  return out;
}

function quotesOf(entry: Record<string, unknown>): { item_id: unknown; quote: unknown }[] {
  const list = Array.isArray(entry["quotes"]) ? entry["quotes"] : [];
  const flat =
    entry["item_id"] !== undefined || entry["quote"] !== undefined
      ? [{ item_id: entry["item_id"], quote: entry["quote"] }]
      : [];
  return [...list, ...flat].filter(
    (row): row is { item_id: unknown; quote: unknown } => Boolean(row) && typeof row === "object",
  );
}

/**
 * Keeps only habits that hold up. The habit's own words must be one short plain line that names no one at the firm
 * and no client, holds no money and no opinion about a person, and carries no link or markup. Each of its quotes must
 * come from an item that was read, be found word for word in what was read, and pass the same people and money
 * checks. A habit left with no quote is dropped, and so is one that states a number none of its quotes holds.
 */
export function checkHabits(
  raw: unknown,
  read: readonly WalkRead[],
  guard: { people: readonly string[]; clients?: readonly string[] },
): { habits: WalkHabit[]; offered: number } {
  const list = Array.isArray(raw) ? raw : [];
  const byId = new Map(read.map((source) => [source.itemId, source]));
  const habits: WalkHabit[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    if (habits.length >= WALK_HABITS_MAX) break;
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const text = typeof row["text"] === "string" ? collapse(row["text"]) : "";
    if (text.length < 8 || text.length > WALK_HABIT_CHARS) continue;
    if (/[<>]|https?:|www\./i.test(text)) continue;
    if (
      mentionsMoney(text) ||
      holdsOpinion(text) ||
      namesStaff(text, guard.people) ||
      namesClient(text, guard.clients ?? []) ||
      TITLED_PERSON.test(text)
    )
      continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;

    const quotes: WalkQuote[] = [];
    for (const offered of quotesOf(row)) {
      if (quotes.length >= WALK_QUOTES_PER_HABIT) break;
      if (typeof offered.item_id !== "string" || typeof offered.quote !== "string") continue;
      const source = byId.get(offered.item_id);
      const quote = collapse(offered.quote);
      if (!source || quote.length > WALK_QUOTE_CHARS || !quotedWordForWord(source.text, quote))
        continue;
      if (mentionsMoney(quote) || holdsOpinion(quote) || namesStaff(quote, guard.people)) continue;
      if (quotes.some((kept) => kept.itemId === source.itemId && kept.quote === quote)) continue;
      quotes.push({
        itemId: source.itemId,
        boardId: source.boardId,
        quote,
        grade: source.grade === "full" ? "quoted" : "from_summary",
      });
    }
    if (!quotes.length) continue;
    // A number the habit states must be in a quote that held: the model types no figure of its own.
    const backed = new Set(quotes.flatMap((quote) => numbersIn(quote.quote)));
    if (numbersIn(text).some((figure) => !backed.has(figure))) continue;
    seen.add(key);
    habits.push({ text, quotes });
  }
  return { habits, offered: list.length };
}
