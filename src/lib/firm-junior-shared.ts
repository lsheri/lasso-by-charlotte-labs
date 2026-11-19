/**
 * Junior tools (Firm Brain Build Spec step 7): which walk-throughs and call roles the firm has work for, and
 * "Prepare me", the questions the firm asked people in one role. Pure parts, so every rule is tested without a
 * database. No model is used anywhere here: questions are found in code, so nothing can be invented.
 *
 * - Only the firm reader's corpus is read, so an unshared board, a private note or an Out item is never counted.
 * - A call on a board the asker is on gives the firm's own questions word for word. Any other call gives lines from
 *   its stored summary only, shown as what was covered, never as quotes (Liam, 18 Nov: calls are summary only
 *   firm-wide).
 * - Only turns spoken by someone at the firm are read for questions. The other side's words and every speaker's name
 *   are never shown.
 * - No line names anyone at the firm or a client, holds money or an opinion about a person, or carries markup.
 * - Nothing is stored.
 */

import {
  METHOD_LABELS,
  METHODS,
  ROLE_LABELS,
  ROLES,
  SITUATIONS,
  type Method,
  type Role,
  type Situation,
} from "./engagement-tags";
import { holdsOpinion } from "./firm-ask-shared";
import { coverageLine, type FirmBoard, type FirmCorpus, type FirmItem } from "./firm-corpus-shared";
import {
  mentionsMoney,
  namesClient,
  namesStaff,
  TITLED_PERSON,
  walkGrade,
  walkScope,
  type WalkTag,
} from "./firm-walkthrough-shared";

export const PREPARE_CALLS_MAX = 8;
export const PREPARE_LINES_MAX = 6;
export const PREPARE_COVERED_MAX = 4;
export const PREPARE_LINE_MIN_CHARS = 12;
export const PREPARE_LINE_MAX_CHARS = 300;
/** About 5,000 tokens: a long call is read from its start only. */
export const PREPARE_CALL_CHARS = 20_000;

/**
 * The walk-through offered when a role has no past calls. The fixed methods have no plain "interviews"; stakeholder
 * interviews is the closest, and the line on screen says which one it is.
 */
export const PREPARE_FALLBACK: WalkTag = { kind: "method", tag: "stakeholder_interviews" };

export const JUNIOR_COPY = {
  walkTitle: "How we do this",
  walkHint: "Pick a kind of problem or a way of working to see how the firm has done it before.",
  walkPick: "Pick a situation or a method",
  walkLabel: "Situation or method",
  situations: "Situations",
  methods: "Methods",
  noTags: "No work shared with the firm carries a situation or a method yet.",
  tagsError: "The list could not be loaded. Try again.",
  retry: "Try again",
  prepareTitle: "Prepare me",
  prepareHint: "Pick who you are about to talk to and see what the firm asked people in that role before.",
  prepareLabel: "Who the call is with",
  preparePick: "Pick a role",
  withCalls: "With past calls",
  withoutCalls: "No past calls yet",
  prepareSubmit: "Prepare me",
  preparePending: "Reading past calls shared with the firm",
  prepareError: "That did not work. Try again.",
  asked: "Questions the firm asked",
  covered: "What was covered",
  coveredNote: "From the call's stored summary. The full call stays with the people on its board.",
  none: (role: string) => `No past call with a ${role} is shared with the firm.`,
  empty: (role: string) =>
    `The firm has past calls with a ${role}, but none has a question or a summary line that can be shown.`,
  fallback: (method: string) => `The closest walk-through is for ${method}. It covers how the firm runs interviews in general.`,
  openSource: "Open the call",
  stored: "Found fresh each time from calls shared with the firm. Nothing is saved.",
} as const;

export type JuniorTagCount<T extends string> = { tag: T; engagements: number };

/** What the pickers offer: tag keys and how many shared engagements carry each. No names, no titles. */
export type JuniorTags = {
  situations: JuniorTagCount<Situation>[];
  methods: JuniorTagCount<Method>[];
  /** Call roles with at least one call in the corpus. */
  roles: JuniorTagCount<Role>[];
};

const isCallFor = (item: FirmItem, role: Role) => item.type === "call" && item.role === role;

/**
 * The situations and methods that have a walk-through to open, and the call roles that have calls, each with a count
 * of engagements. Read from the asker's corpus only, in vocabulary order. "Other" is never offered.
 */
export function juniorTags(corpus: FirmCorpus): JuniorTags {
  const known = new Set(corpus.boards.map((board) => board.id));
  const count = (tag: WalkTag) => walkScope(corpus, tag).boards.length;
  const situations = SITUATIONS.filter((tag) => tag !== "other")
    .map((tag) => ({ tag, engagements: count({ kind: "situation", tag }) }))
    .filter((row) => row.engagements > 0);
  const methods = METHODS.filter((tag) => tag !== "other")
    .map((tag) => ({ tag, engagements: count({ kind: "method", tag }) }))
    .filter((row) => row.engagements > 0);
  const roles = ROLES.filter((role) => role !== "other")
    .map((role) => ({
      tag: role,
      engagements: new Set(
        corpus.items.filter((item) => isCallFor(item, role) && known.has(item.boardId)).map((item) => item.boardId),
      ).size,
    }))
    .filter((row) => row.engagements > 0);
  return { situations, methods, roles };
}

/** A role from the fixed list, or null. "Other" has no Prepare me: it is where an unknown value lands. */
export function parsePrepareRole(value: unknown): Role | null {
  if (typeof value !== "string" || value === "other") return null;
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
/** Lower case with accents removed, so "Zoë" and "ZOE" are the same speaker. */
const fold = (text: string) =>
  collapse(text)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

export type CallTurn = { speaker: string; text: string };

/** "**Ines:** What", "**Ines**: What" and "Ines: What", as call imports and pasted notes write a turn. */
const TURN = /^\s*(?:[-*>]\s+)?(?:\*\*|__)?\s*([^:*_\n]{1,60}?)\s*(?::\s*(?:\*\*|__)|(?:\*\*|__)\s*:|:)\s+(\S.*)$/;

/**
 * A call's text as turns. A line that starts with a speaker label opens a turn; plain lines after it belong to the
 * same speaker; a heading or a line of emphasis (the import's own note about labels) ends the turn. Text before the
 * first label has no speaker and is not a turn.
 */
export function callTurns(text: string): CallTurn[] {
  const turns: CallTurn[] = [];
  let current: CallTurn | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,6}\s/.test(line) || /^_.*_$/.test(line)) {
      current = null;
      continue;
    }
    const match = TURN.exec(line);
    if (match) {
      current = { speaker: collapse(match[1]!), text: match[2]!.trim() };
      turns.push(current);
    } else if (current) {
      current.text += ` ${line}`;
    }
  }
  return turns;
}

/**
 * Is this speaker label someone at the firm? The label, without anything in brackets, must be a person's full name
 * or one whole part of it (a first name or a surname), in any case and with or without accents. Anything else, such
 * as "Director", "Others on the call" or a name the firm does not hold, is not the firm's side.
 */
export function isFirmSpeaker(label: string, people: readonly string[]): boolean {
  const said = fold(label.replace(/\([^)]*\)/g, " "));
  if (said.length < 2) return false;
  return people.some((person) => {
    const name = fold(person ?? "");
    if (name.length < 2) return false;
    return name === said || name.split(/[\s-]+/).some((part) => part.length >= 2 && part === said);
  });
}

export type PrepareGuard = { people: readonly string[]; clients: readonly string[] };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const holdsWord = (text: string, word: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, "u").test(text);

/**
 * May this line be shown? One plain line of a sane length with no markup or link, naming no one at the firm, no
 * client and no titled person, with no money and no opinion about a person. `others` are the call's other speaker
 * labels: a line that says one of them is dropped, since a label is often a name.
 */
export function prepareLineOk(line: string, guard: PrepareGuard, others: readonly string[] = []): boolean {
  if (line.length < PREPARE_LINE_MIN_CHARS || line.length > PREPARE_LINE_MAX_CHARS) return false;
  if (/[<>]|https?:|www\./i.test(line)) return false;
  if (mentionsMoney(line) || holdsOpinion(line) || TITLED_PERSON.test(line)) return false;
  if (namesStaff(line, guard.people) || namesClient(line, guard.clients)) return false;
  return !others.some((label) => label.length >= 3 && holdsWord(line, label));
}

/** A full stop that does not end a sentence: "St. Brigid", "Dr. Okafor", "J. Smith", "vs. last year". */
const ABBREVIATION = /(?<![\p{L}\p{N}])(?:St|Dr|Mr|Mrs|Ms|Mx|Prof|Jr|Sr|vs|etc|Inc|Ltd|Co|No|approx|\p{Lu})\.(?=\s)/gu;
const HELD_STOP = "\u0001";

/**
 * Sentences, without cutting after an abbreviation: a cut there would leave "Brigid Health tried this?" as a line of
 * its own, with the half of the name that the checks look for gone.
 */
const sentences = (text: string) =>
  text
    .replace(ABBREVIATION, (match) => `${match.slice(0, -1)}${HELD_STOP}`)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => collapse(part.replaceAll(HELD_STOP, ".").replace(/^[-*>\s]+/, "")))
    .filter(Boolean);

function unique(lines: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * The questions the firm's own side asked in one call, word for word and in the order asked: sentences ending in a
 * question mark, in turns whose speaker is someone at the firm. A turn by anyone else is never read.
 */
export function firmSideQuestions(text: string, guard: PrepareGuard): string[] {
  const turns = callTurns(text.slice(0, PREPARE_CALL_CHARS));
  const others = [...new Set(turns.map((turn) => turn.speaker).filter((label) => !isFirmSpeaker(label, guard.people)))];
  const found = turns
    .filter((turn) => isFirmSpeaker(turn.speaker, guard.people))
    .flatMap((turn) => sentences(turn.text))
    .filter((line) => line.endsWith("?") && prepareLineOk(line, guard, others));
  return unique(found, PREPARE_LINES_MAX);
}

/** Lines from a call's stored summary and decisions that may be shown, as what the call covered. */
export function coveredLines(item: Pick<FirmItem, "summary" | "decisions">, guard: PrepareGuard): string[] {
  const card = [item.summary, item.decisions].filter(Boolean).join("\n");
  return unique(
    sentences(card).filter((line) => prepareLineOk(line, guard)),
    PREPARE_COVERED_MAX,
  );
}

export type PrepareEntry = {
  itemId: string;
  boardId: string;
  /** The engagement's name: its client, or its title for a board with no client. Never the call's own title. */
  engagement: string;
  /** Always set: the call's date, or the day its engagement started. */
  date: string;
  /** asked: the firm's own questions, word for word. covered: lines from the stored summary, not quotes. */
  grade: "asked" | "covered";
  lines: string[];
};

export type FirmPrepareResult = {
  /**
   * questions: at least one call gave the firm's own questions. covered: summaries only. empty: there are calls, but
   * nothing in them may be shown. none: no call with this role is shared with the firm.
   */
  status: "questions" | "covered" | "empty" | "none";
  role: Role;
  label: string;
  /** Calls with this role that the firm reader serves this asker. */
  calls: number;
  entries: PrepareEntry[];
  /** The general walk-through, offered when there is nothing to show. */
  fallback: { kind: "method"; tag: Method; label: string };
  coverage: string;
};

/** The calls with one role, newest first, each with its board. Chosen in code from the corpus alone. */
export function prepareCalls(corpus: FirmCorpus, role: Role): { item: FirmItem; board: FirmBoard }[] {
  const boards = new Map(corpus.boards.map((board) => [board.id, board]));
  return corpus.items
    .filter((item) => isCallFor(item, role) && boards.has(item.boardId))
    .map((item) => ({ item, board: boards.get(item.boardId)! }))
    .sort(
      (a, b) =>
        (b.item.date ?? b.board.startedOn).localeCompare(a.item.date ?? a.board.startedOn) ||
        a.item.id.localeCompare(b.item.id),
    );
}

export type PrepareDeps = {
  /** The full text of an item the corpus lets the asker quote, or null. */
  loadText: (itemId: string) => Promise<string | null>;
};

export type PrepareInput = {
  corpus: FirmCorpus;
  role: Role;
  /** Everyone at the firm, by display name: whose turns count as the firm's side, and whom no line may name. */
  people: readonly string[];
};

/**
 * "Prepare me" for one role. A call's body is loaded only when the asker is on its board; every other call is read
 * from its stored summary, so its words can never be shown as a quote.
 */
export async function runFirmPrepare(deps: PrepareDeps, input: PrepareInput): Promise<FirmPrepareResult> {
  const { corpus, role } = input;
  const people = input.people.filter((name) => typeof name === "string" && name.trim().length > 1);
  // Without the firm's people there is no way to tell the firm's side or to check names, so there is no answer.
  if (!people.length) throw new Error("The firm's people could not be read.");
  const guard: PrepareGuard = {
    people,
    clients: corpus.boards.flatMap((board) => (board.client ? [board.client] : [])),
  };
  const fallbackTag = PREPARE_FALLBACK.tag as Method;
  const calls = prepareCalls(corpus, role);
  const entries: PrepareEntry[] = [];
  for (const { item, board } of calls) {
    if (entries.length >= PREPARE_CALLS_MAX) break;
    const base = {
      itemId: item.id,
      boardId: board.id,
      engagement: board.client?.trim() || board.title,
      date: item.date ?? board.startedOn,
    };
    if (walkGrade(item, board) === "full") {
      const text = await deps.loadText(item.id);
      const asked = text?.trim() ? firmSideQuestions(text, guard) : [];
      if (asked.length) {
        entries.push({ ...base, grade: "asked", lines: asked });
        continue;
      }
    }
    const covered = coveredLines(item, guard);
    if (covered.length) entries.push({ ...base, grade: "covered", lines: covered });
  }
  const status: FirmPrepareResult["status"] = !calls.length
    ? "none"
    : !entries.length
      ? "empty"
      : entries.some((entry) => entry.grade === "asked")
        ? "questions"
        : "covered";
  return {
    status,
    role,
    label: ROLE_LABELS[role],
    calls: calls.length,
    entries,
    fallback: { kind: "method", tag: fallbackTag, label: METHOD_LABELS[fallbackTag] },
    coverage: coverageLine(corpus),
  };
}
