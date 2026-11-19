/**
 * 19 Nov, Firm Brain Build Spec step 8: manager tools. The pure rules behind the reading list (up to three shared
 * engagements pinned to a board), the exemplar mark and the firm's common question kinds, so each can be tested
 * without a database. The server files apply them; the company-brain flag only hides the screens.
 *
 * Three promises hold everywhere here: a reading list shows only engagements the reader may already see, a kind of
 * question appears only once five people have asked it, and nothing says who pinned, who marked, who asked or whose
 * work was marked.
 */

import { METHOD_LABELS, METHODS, SITUATION_LABELS, SITUATIONS, type Method, type Situation } from "./engagement-tags";
import { FIRM_ASK_STARTER_COPY, FIRM_ASK_STARTERS, type FirmAskStarter } from "./firm-ask-shared";
import type { FirmCorpus } from "./firm-corpus-shared";
import { assembleFirmGraph } from "./firm-graph-shared";
import { bucket } from "./telemetry-shared";

/* ---------- what a caller may send ---------- */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProfileInput = { profile_id?: string | null | undefined };
export type BoardInput = ProfileInput & { board_id: string };
export type PinInput = BoardInput & { thread_id: string };
export type ExemplarInput = ProfileInput & { item_id: string; engagement_id?: string | null | undefined };

function idOf(value: unknown, problem: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!UUID.test(text)) throw new Error(problem);
  return text.toLowerCase();
}

/** Only a profile id is read; anything else sent (a workspace id, say) is dropped. */
export function validateProfileInput(input: ProfileInput): ProfileInput {
  return { profile_id: typeof input?.profile_id === "string" && input.profile_id.trim() ? input.profile_id.trim() : null };
}

export function validateBoardInput(input: BoardInput): BoardInput {
  return { ...validateProfileInput(input), board_id: idOf(input?.board_id, "Unknown board.") };
}

export function validatePinInput(input: PinInput): PinInput {
  return { ...validateBoardInput(input), thread_id: idOf(input?.thread_id, "Unknown engagement.") };
}

export function validateExemplarInput(input: ExemplarInput): ExemplarInput {
  return {
    ...validateProfileInput(input),
    item_id: idOf(input?.item_id, "Unknown work."),
    engagement_id: input?.engagement_id ? idOf(input.engagement_id, "Unknown board.") : null,
  };
}

/* ---------- who may ---------- */

function leads(role: string | null | undefined): boolean {
  return role === "admin" || role === "lead";
}

/** Admins and leads of the workspace pin on any of its boards; a board's owner pins on their own board. */
export function canPinReading(role: string | null | undefined, ownsBoard: boolean): boolean {
  return leads(role) || (ownsBoard && role === "em");
}

/** Only admins and leads mark or unmark an exemplar. */
export function canMarkExemplar(role: string | null | undefined): boolean {
  return leads(role);
}

/** Only admins and leads see what people ask the firm. */
export function canSeeCommonQuestions(role: string | null | undefined): boolean {
  return leads(role);
}

/* ---------- the reading list ---------- */

export const READING_SLOTS = [1, 2, 3] as const;
export type ReadingSlot = (typeof READING_SLOTS)[number];

/** The lowest free slot, or null when all three are taken. Slots outside 1 to 3 are ignored. */
export function firstFreeSlot(taken: readonly number[]): ReadingSlot | null {
  return READING_SLOTS.find((slot) => !taken.includes(slot)) ?? null;
}

export const READING_LIST_COPY = {
  menu: "Reading list",
  title: "Reading list",
  helper: "Up to three engagements shared with the firm, pinned here for the people on this board to read.",
  loading: "Loading the reading list",
  loadFailed: "The reading list could not be loaded. Close this and try again.",
  empty: "Nothing is pinned to this board yet.",
  emptyCanPin: "Nothing is pinned yet. Add up to three engagements shared with the firm.",
  full: "Three engagements are pinned. Remove one to add another.",
  addLabel: "Add an engagement",
  choose: "Choose an engagement",
  add: "Add",
  adding: "Adding",
  remove: "Remove",
  removeLabel: (title: string) => `Remove ${title} from the reading list`,
  open: "Open",
  openLabel: (title: string) => `Open ${title}`,
  noSource: "Nothing in this engagement can be opened from here yet.",
  nothingToAdd: "No other engagements are shared with the firm yet.",
  close: "Close",
  failed: "That did not save. Try again.",
  refusedNotShared: "Only an engagement shared with the firm can be pinned.",
  refusedSelf: "A board cannot be pinned to its own reading list.",
  refusedFull: "This reading list is full. Remove one to add another.",
  refusedAlready: "That engagement is already on this reading list.",
  refusedChanged: "The reading list changed while you were adding. Check it and try again.",
} as const;

/** One pinned engagement as the reader sees it. No person appears: not the pinner, not the engagement's lead. */
export type ReadingPin = {
  threadId: string;
  slot: ReadingSlot;
  title: string;
  client: string | null;
  /** The situation label from the fixed list. */
  situation: string;
  /** The item that opens in the firm source preview (the SOW, else the first client deck item), or null. */
  sourceItemId: string | null;
};

/** An engagement that may be added: shared with the firm, not this board, not already pinned. */
export type ReadingChoice = { threadId: string; title: string; client: string | null };

export type ReadingList = {
  pins: ReadingPin[];
  /** Empty for people who may not pin. */
  choices: ReadingChoice[];
  canPin: boolean;
  full: boolean;
};

export type ReadingWrite = { ok: true; list: ReadingList } | { ok: false; refusal: string };

type PinRow = { thread_id: string; slot: number };

/**
 * The list one reader sees: pins whose engagement the firm reader serves this reader, in slot order. A pin whose
 * engagement is no longer shared is not in the corpus, so it drops out here whatever the database returned, and comes
 * back when sharing is turned on again.
 */
export function readingListView(rows: readonly PinRow[], corpus: FirmCorpus, boardId: string, canPin: boolean): ReadingList {
  const threads = new Map(assembleFirmGraph(corpus).threads.map((thread) => [thread.id, thread]));
  const seen = new Set<string>();
  const pins: ReadingPin[] = [];
  for (const row of [...rows].sort((a, b) => a.slot - b.slot)) {
    const thread = threads.get(row.thread_id);
    if (!thread || seen.has(thread.id) || row.thread_id === boardId || !(READING_SLOTS as readonly number[]).includes(row.slot)) continue;
    seen.add(thread.id);
    const situation = thread.stops.find((stop) => stop.kind === "situation");
    const deck = thread.stops.find((stop) => stop.kind === "client_deck");
    pins.push({
      threadId: thread.id,
      slot: row.slot as ReadingSlot,
      title: thread.title,
      client: thread.client,
      situation: SITUATION_LABELS[thread.situation],
      sourceItemId: (situation?.kind === "situation" ? situation.itemId : null) ?? (deck?.kind === "client_deck" ? (deck.itemIds[0] ?? null) : null),
    });
    if (pins.length === READING_SLOTS.length) break;
  }
  const choices: ReadingChoice[] = canPin
    ? [...threads.values()]
        .filter((thread) => thread.id !== boardId && !seen.has(thread.id))
        .map((thread) => ({ threadId: thread.id, title: thread.title, client: thread.client }))
        .sort((a, b) => a.title.localeCompare(b.title) || a.threadId.localeCompare(b.threadId))
    : [];
  return { pins, choices, canPin, full: pins.length >= READING_SLOTS.length };
}

/**
 * A plain line for a write the database refused, so a guard or a unique rule never reaches the person as an error
 * page. The database's own words are not passed on.
 */
export function pinRefusal(error: { code?: string | null; message?: string | null } | null | undefined): string {
  const message = `${error?.message ?? ""}`.toLowerCase();
  if (error?.code === "23505" || message.includes("duplicate key")) return READING_LIST_COPY.refusedChanged;
  if (message.includes("not_self")) return READING_LIST_COPY.refusedSelf;
  if (message.includes("shared with the firm") || message.includes("not in this workspace") || message.includes("company workspaces")) return READING_LIST_COPY.refusedNotShared;
  return READING_LIST_COPY.failed;
}

/* ---------- exemplars ---------- */

export const EXEMPLAR_COPY = {
  badge: "Exemplar",
  badgeTitle: "Marked by the firm as an example of good work",
  mark: "Mark as exemplar",
  unmark: "Remove exemplar mark",
  failed: "That did not save. Try again.",
  refusedNotShared: "Only work on a board shared with the firm can be an exemplar.",
} as const;

export type ExemplarWrite = { ok: true; exemplar: boolean } | { ok: false; refusal: string };

/** Exemplars first, otherwise the order given. Stable, so nothing else about the order changes. */
export function exemplarsFirst<T extends { exemplar?: boolean | undefined }>(list: readonly T[]): T[] {
  return [...list.filter((entry) => entry.exemplar === true), ...list.filter((entry) => entry.exemplar !== true)];
}

/* ---------- what people ask the firm ---------- */

export const COMMON_QUESTIONS_COPY = {
  title: "What people ask the firm",
  helper: "Kinds of question, counted across the firm over the last 90 days. No names, and no wording of any question.",
  empty: "Not enough people have asked yet. A kind of question appears here once five people have asked it.",
  loading: "Counting",
  error: "That could not be loaded. Try again.",
} as const;

/** The only bands the database returns. There is no band under five. */
export const ASKER_BANDS: Readonly<Record<string, string>> = {
  "5 to 9": "5 to 9 people",
  "10 to 24": "10 to 24 people",
  "25 or more": "25 or more people",
};

export type TopicKind = `situation_${Situation}` | `method_${Method}` | "none";

/** The fixed label for a recorded topic kind, or null for anything not on the lists (and for "other" and "none"). */
export function topicLabel(kind: string): string | null {
  if (kind.startsWith("situation_")) {
    const id = kind.slice("situation_".length) as Situation;
    return id !== "other" && (SITUATIONS as readonly string[]).includes(id) ? SITUATION_LABELS[id] : null;
  }
  if (kind.startsWith("method_")) {
    const id = kind.slice("method_".length) as Method;
    return id !== "other" && (METHODS as readonly string[]).includes(id) ? METHOD_LABELS[id] : null;
  }
  return null;
}

/** One line on the card: a fixed label and a band. Nothing else exists to show. */
export type CommonQuestion = { label: string; band: string };

/**
 * Turns what the database function returned into lines for the card. A kind or band that is not on the fixed lists
 * is dropped, so nothing typed by anyone and no exact count can pass through.
 */
export function commonQuestionLines(rows: unknown): CommonQuestion[] {
  const out: CommonQuestion[] = [];
  const seen = new Set<string>();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") continue;
    const { question_source: source, question_kind: kind, askers_band: bandKey } = row as Record<string, unknown>;
    if (typeof kind !== "string" || typeof bandKey !== "string") continue;
    const band = Object.prototype.hasOwnProperty.call(ASKER_BANDS, bandKey) ? ASKER_BANDS[bandKey] : undefined;
    const label =
      source === "starter"
        ? (FIRM_ASK_STARTERS as readonly string[]).includes(kind)
          ? FIRM_ASK_STARTER_COPY[kind as FirmAskStarter].label
          : null
        : source === "topic"
          ? topicLabel(kind)
          : null;
    if (!band || !label || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, band });
  }
  return out;
}

/** A few everyday words for each kind, beside its own label. Lower case; matched as whole words. */
const SITUATION_WORDS: Record<Exclude<Situation, "other">, readonly string[]> = {
  new_offering: ["new service", "new program", "new programme", "new offering", "new product", "launch", "launching"],
  growth_move: ["growth strategy", "where to grow", "market entry", "expansion", "expand"],
  pricing: ["pricing", "price", "prices"],
  operating_model: ["operating model", "reorganisation", "reorganization", "restructure", "restructuring"],
  integration: ["integration", "integrating", "post-merger", "post merger", "merger"],
  deal_diligence: ["due diligence", "diligence"],
  fundraising: ["fundraising", "fundraise", "raising money", "raise money", "investors"],
  new_revenue: ["new revenue", "revenue stream", "revenue streams", "sustainability"],
  customer_adoption: ["adoption", "onboarding", "retention", "churn"],
  marketing_proof: ["marketing roi", "marketing return", "attribution", "marketing"],
  talent: ["talent", "hiring", "recruitment", "recruiting", "workforce"],
  outside_approval: ["regulatory approval", "accreditation", "regulator", "regulators", "approval"],
};

const METHOD_WORDS: Record<Exclude<Method, "other">, readonly string[]> = {
  stakeholder_interviews: ["stakeholder interviews", "stakeholder interview", "interviews"],
  customer_research: ["customer research", "user research"],
  expert_calls: ["expert calls", "expert call", "expert interviews"],
  survey: ["survey", "surveys"],
  desk_research: ["desk research", "benchmark", "benchmarks", "benchmarking"],
  data_analysis: ["data analysis", "analytics"],
  market_sizing: ["market sizing", "market size"],
  financial_model: ["financial model", "pricing model", "business case"],
  workshop: ["workshop", "workshops", "co-design"],
  outreach: ["outreach"],
  operating_model_design: ["operating model design"],
  implementation_plan: ["roadmap", "implementation plan"],
  synthesis: ["synthesis", "storyline"],
};

function phrasePattern(phrase: string): RegExp {
  const body = phrase
    .toLowerCase()
    .split(/[\s-]+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s-]+");
  return new RegExp(`(?:^|[^a-z0-9])${body}(?![a-z0-9])`);
}

const TOPIC_PHRASES: { kind: TopicKind; pattern: RegExp; weight: number }[] = [
  ...SITUATIONS.filter((id): id is Exclude<Situation, "other"> => id !== "other").flatMap((id) =>
    [SITUATION_LABELS[id], ...SITUATION_WORDS[id]].map((phrase) => ({ kind: `situation_${id}` as TopicKind, pattern: phrasePattern(phrase), weight: phrase.length })),
  ),
  ...METHODS.filter((id): id is Exclude<Method, "other"> => id !== "other").flatMap((id) =>
    [METHOD_LABELS[id], ...METHOD_WORDS[id]].map((phrase) => ({ kind: `method_${id}` as TopicKind, pattern: phrasePattern(phrase), weight: phrase.length })),
  ),
];

/**
 * The kind of a question, read in code against the fixed situation and method lists: no model, and never the
 * question's own words. The longest phrase found wins ("operating model design" over "operating model"); a tie goes
 * to the earlier entry in the lists. Nothing found is "none". The return value is always one of a closed set.
 */
export function classifyQuestionTopic(question: unknown): TopicKind {
  if (typeof question !== "string") return "none";
  const text = question.toLowerCase().slice(0, 2000);
  let best: { kind: TopicKind; weight: number } | null = null;
  for (const entry of TOPIC_PHRASES) {
    if (best && entry.weight <= best.weight) continue;
    if (entry.pattern.test(text)) best = entry;
  }
  return best?.kind ?? "none";
}

/**
 * Everything the firm_ask.asked event carries: buckets and fixed kinds. The question goes in and only its kind comes
 * out, so no word of it can travel with the event.
 */
export function firmAskedDims(input: { status: string; boardsRead: number; sources: number; starter: string | null | undefined; question: string }): Record<string, string> {
  return {
    result: input.status,
    boards_read: bucket(input.boardsRead),
    sources: bucket(input.sources),
    starter: (FIRM_ASK_STARTERS as readonly string[]).includes(input.starter ?? "") ? (input.starter as string) : "none",
    topic: classifyQuestionTopic(input.question),
  };
}

/** Every value classifyQuestionTopic can return. */
export const TOPIC_KINDS: readonly TopicKind[] = ["none", ...new Set(TOPIC_PHRASES.map((entry) => entry.kind))];
