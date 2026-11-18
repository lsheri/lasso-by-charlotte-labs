/**
 * Start a proposal, step 2 (firm-brain-review RECOMMENDATION section 4, "Draft form"): a full first draft delivered
 * as sections, each "Draft, not reviewed" until a person confirms it. Pure parts, tested without a model:
 *
 * - Precedent packs never carry another client's name: client names and the proper names in their index cards are
 *   masked before the model reads them, and searched for again in what it writes.
 * - The fee section is always "Fee: for partner decision." and the team section is role slots only. Code writes both.
 * - A stated fact counts only when its quote is found word for word in the item it cites. Borrowed structure cites a
 *   board, and looks different.
 * - Any money or week figure must appear in a cited item or the intake; otherwise it is removed and flagged.
 * - Three to six closed questions for the lead, each with a default. Prepared for the owner to send; nothing is sent.
 */

import { maskFees } from "./firm-ask-shared";
import type { FirmCorpus } from "./firm-corpus-shared";
import { containsVerbatim } from "./span-provenance-shared";

export const PROPOSAL_SECTIONS = [
  { key: "context", heading: "Context" },
  { key: "objectives", heading: "Objectives" },
  { key: "approach", heading: "Approach" },
  { key: "workstreams", heading: "Workstreams" },
  { key: "deliverables", heading: "Deliverables" },
  { key: "timeline", heading: "Timeline" },
  { key: "assumptions", heading: "Assumptions and exclusions" },
  { key: "fee", heading: "Fees" },
  { key: "team", heading: "Team" },
] as const;
export type ProposalSectionKey = (typeof PROPOSAL_SECTIONS)[number]["key"];

/** Sections the model writes. Fee and team are written by code. */
export const MODEL_SECTIONS: readonly ProposalSectionKey[] = ["context", "objectives", "approach", "workstreams", "deliverables", "timeline", "assumptions"];

export const QUESTIONS_MIN = 3;
export const QUESTIONS_MAX = 6;
export const SECTION_CHARS = 2_400;
export const TEAM_ROLES_MAX = 6;
export const FEE_LINE = "Fee: for partner decision.";
export const GAP_LINE = "Gap: nothing on this board or in past work supports this section yet. It is a question for the lead.";

export const DRAFT_COPY = {
  draft: "Draft the proposal",
  drafting: "Writing the first draft",
  draftHint: "Uses this board's notes and the precedents above. Other clients' names are masked before anything is written.",
  title: "First draft",
  notReviewed: "Draft, not reviewed",
  confirmed: "Confirmed",
  gap: "Gap",
  confirm: "Confirm section",
  structureFrom: (title: string) => `Structure from a past engagement: ${title}`,
  factFrom: (title: string) => `From ${title}`,
  noLongerShared: "Source no longer shared with the firm",
  questionsTitle: "Questions for the lead",
  questionsHint: "Copy these and send them yourself. Nothing is sent from here.",
  copyQuestions: "Copy questions",
  copied: "Copied",
  defaultLabel: "Default",
  unconfirmed: (count: number) => `${count} ${count === 1 ? "section" : "sections"} not yet confirmed`,
  openQuestions: (count: number) => `${count} open ${count === 1 ? "question" : "questions"} for the lead`,
  feeNotSet: "Fee not set",
  ready: "Every section confirmed",
  namesPassed: "Name check passed. No other client's name appears.",
  namesRedrafted: "Name check passed after one redraft.",
  namesBlocked: (count: number) => `Name check removed ${count} ${count === 1 ? "section" : "sections"}. They are left as gaps.`,
  figuresRemoved: (count: number) => `${count} ${count === 1 ? "figure" : "figures"} removed: not found in a source or the notes.`,
  newFacts: (count: number) => `${count} ${count === 1 ? "sentence states" : "sentences state"} something about this client that the notes do not. Marked below.`,
  figureFlag: "A figure here was removed because no source or note states it.",
  factFlag: "Not in the notes about this client:",
  onBoard: "Saved to this board as a document card.",
  reopen: "Last draft on this board",
} as const;

export type DraftSource =
  | { kind: "structure"; boardId: string; boardTitle: string }
  | { kind: "fact"; itemId: string; itemTitle: string; quote: string; shared?: boolean };

export type DraftSection = {
  key: ProposalSectionKey;
  heading: string;
  body: string;
  status: "draft" | "confirmed" | "gap";
  sources: DraftSource[];
  flags: string[];
};

export type DraftQuestion = { text: string; fallback: string };

export type DraftChecks = { names: "passed" | "redrafted" | "blocked"; blocked: number; figuresRemoved: number; newFacts: number };

export type ProposalDraft = {
  sections: DraftSection[];
  questions: DraftQuestion[];
  checks: DraftChecks;
  precedentIds: string[];
  createdAt: string;
};

/** Words in an index card that are proper nouns but never a client's or person's name. */
const NOT_NAMES = new Set([
  "vp", "svp", "evp", "chief", "head", "director", "manager", "lead", "officer", "board", "president", "partner", "chair",
  "cfo", "ceo", "cmo", "coo", "cio", "cto", "cno", "medicaid", "medicare", "option", "phase", "wave", "plan", "model",
  "program", "programme", "service", "line", "care", "health", "steering", "committee", "council", "team", "office",
]);

/**
 * An index-card term that reads as a person's or organisation's own name: two or more capitalised words with no role
 * or business words ("Dana Whitfield"). Topics, roles, codes and single words ("SteerCo", "Option B", "P&L", "Chair of
 * Psychiatry") are not names. Client names are covered separately, from each board's client.
 */
export function looksLikeName(term: string): boolean {
  const words = term.trim().split(/\s+/);
  if (words.length < 2) return false;
  if (!words.every((word) => /^[A-Z][a-z'’.-]+$/.test(word))) return false;
  return !words.some((word) => NOT_NAMES.has(word.toLowerCase().replace(/[.']/g, "")));
}

export type NameTerm = { term: string; replacement: string };

/** A client's name and its leading short forms ("St. Brigid Health", "St. Brigid"), never a bare "St." or "The". */
export function clientVariants(client: string): string[] {
  const words = client.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let end = words.length; end >= 1; end -= 1) {
    const form = words.slice(0, end).join(" ");
    if (form.replace(/[^A-Za-z]/g, "").length >= 4 && !/^(the|saint|north|south|east|west|new)$/i.test(form)) out.push(form);
  }
  return out;
}

/**
 * Every other client's name the model must not see or write: each precedent's client name and its first word, and
 * the proper names in its items' index cards. A term the new client's own notes use is never masked.
 */
export function forbiddenNames(corpus: FirmCorpus, boardIds: readonly string[], intake: string): NameTerm[] {
  const lowerIntake = intake.toLowerCase();
  const out = new Map<string, string>();
  boardIds.forEach((boardId, index) => {
    const board = corpus.boards.find((entry) => entry.id === boardId);
    if (!board) return;
    const letter = String.fromCharCode(65 + index);
    const client = board.client?.trim();
    if (client) for (const form of clientVariants(client)) out.set(form, `[CLIENT ${letter}]`);
    for (const item of corpus.items.filter((entry) => entry.boardId === boardId)) {
      for (const raw of (item.entities ?? "").split(",")) {
        const term = raw.trim();
        if (looksLikeName(term) && !out.has(term)) out.set(term, "[NAME]");
      }
    }
  });
  return [...out.entries()]
    .filter(([term]) => !lowerIntake.includes(term.toLowerCase()))
    .map(([term, replacement]) => ({ term, replacement }))
    .sort((a, b) => b.term.length - a.term.length);
}

function termPattern(term: string): RegExp {
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}(?:'s)?\\b`, "gi");
}

/** Text with every forbidden name replaced, longest first so "Willowmere Community Health" masks whole. */
export function maskNames(text: string, terms: readonly NameTerm[]): string {
  return terms.reduce((out, { term, replacement }) => out.replace(termPattern(term), replacement), text);
}

/** The forbidden names a text still contains. */
export function findNames(text: string, terms: readonly NameTerm[]): string[] {
  return terms.filter(({ term }) => termPattern(term).test(text)).map(({ term }) => term);
}

const FIGURE = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|bn|million|thousand)\b)?|\b\d+(?:\s*(?:to|-)\s*\d+)?\s*weeks?\b/gi;

function figureKey(figure: string): string {
  return figure.toLowerCase().replace(/\s+/g, " ").replace(/\s*-\s*/g, " to ").trim();
}

/** Money and week figures not stated in any allowed text are removed. */
export function checkFigures(text: string, allowed: readonly string[]): { text: string; removed: number } {
  const pool = allowed.map((entry) => entry.toLowerCase().replace(/\s+/g, " ").replace(/\s*-\s*/g, " to "));
  let removed = 0;
  const out = text.replace(FIGURE, (figure) => {
    if (pool.some((entry) => entry.includes(figureKey(figure)))) return figure;
    removed += 1;
    return "[figure removed]";
  });
  return { text: out, removed };
}

export type DraftContext = {
  /** The precedent boards, in pack order. */
  precedents: { boardId: string; title: string }[];
  /** Items the model may quote: precedent items read in full, and the new board's own items. */
  quotable: Map<string, { title: string; text: string }>;
  intake: string;
  terms: NameTerm[];
};

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/—/g, ", ").trim().slice(0, max) : "";
}

function sourcesOf(raw: unknown, ctx: DraftContext): DraftSource[] {
  const out: DraftSource[] = [];
  for (const entry of Array.isArray(raw) ? raw.slice(0, 6) : []) {
    if (!entry || typeof entry !== "object") continue;
    const { board_id, item_id, quote } = entry as Record<string, unknown>;
    if (typeof item_id === "string" && typeof quote === "string") {
      const item = ctx.quotable.get(item_id);
      if (item && containsVerbatim(item.text, quote)) out.push({ kind: "fact", itemId: item_id, itemTitle: item.title, quote: maskNames(maskFees(quote.trim()), ctx.terms).slice(0, 400) });
    } else if (typeof board_id === "string") {
      const board = ctx.precedents.find((entry) => entry.boardId === board_id);
      if (board && !out.some((source) => source.kind === "structure" && source.boardId === board_id)) out.push({ kind: "structure", boardId: board_id, boardTitle: board.title });
    }
  }
  return out;
}

/** Role slots only: a short role label per line, never a name. */
export function teamSlots(raw: unknown, terms: readonly NameTerm[]): string {
  const roles = (Array.isArray(raw) ? raw : [])
    .map((role) => str(role, 60))
    .filter((role) => role && !findNames(role, terms).length && !/\b(?:Dr|Mr|Ms|Mrs)\.?\s/i.test(role))
    .slice(0, TEAM_ROLES_MAX);
  const list = roles.length ? roles : ["Engagement lead", "Project manager", "Analyst"];
  return list.map((role) => `- ${role}: to be staffed`).join("\n");
}

/** The model's sections and questions, checked. Names are searched by the caller, which may redraft. */
export function parseDraft(raw: Record<string, unknown>, ctx: DraftContext): { sections: DraftSection[]; questions: DraftQuestion[]; figuresRemoved: number } {
  const given = raw["sections"] && typeof raw["sections"] === "object" ? (raw["sections"] as Record<string, unknown>) : {};
  const allowed = [ctx.intake, ...[...ctx.quotable.values()].map((item) => item.text)];
  let figuresRemoved = 0;
  const sections: DraftSection[] = PROPOSAL_SECTIONS.map(({ key, heading }) => {
    if (key === "fee") return { key, heading, body: FEE_LINE, status: "draft", sources: [], flags: [] };
    if (key === "team") return { key, heading, body: teamSlots(raw["team_roles"], ctx.terms), status: "draft", sources: [], flags: [] };
    const entry = given[key] && typeof given[key] === "object" ? (given[key] as Record<string, unknown>) : {};
    // A model sometimes returns a body as a list of lines; it is the same text.
    const rawBody = Array.isArray(entry["body"]) ? entry["body"].filter((line): line is string => typeof line === "string").join("\n") : entry["body"];
    const body = maskFees(str(rawBody, SECTION_CHARS));
    if (!body || entry["gap"] === true) return { key, heading, body: GAP_LINE, status: "gap", sources: [], flags: [] };
    const figures = checkFigures(body, allowed);
    figuresRemoved += figures.removed;
    return { key, heading, body: figures.text, status: "draft", sources: sourcesOf(entry["sources"], ctx), flags: figures.removed ? [DRAFT_COPY.figureFlag] : [] };
  });
  const questions = (Array.isArray(raw["questions"]) ? raw["questions"] : [])
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}))
    .map((entry) => ({ text: maskFees(str(entry["question"], 300)), fallback: maskFees(str(entry["default"], 200)) }))
    .filter((question) => question.text && question.fallback && !findNames(`${question.text} ${question.fallback}`, ctx.terms).length)
    .slice(0, QUESTIONS_MAX);
  return { sections, questions, figuresRemoved };
}

/** The complete JSON object or array that opens at `start`, or null when the text ends first. */
function balanced(text: string, start: number): string | null {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!;
    if (inString) {
      if (char === "\\") index += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close && (depth -= 1) === 0) return text.slice(start, index + 1);
  }
  return null;
}

/**
 * A draft from a reply cut off at its token limit: every section object and team list that completed, and every
 * complete question. Whatever was cut off stays missing, so it becomes a gap rather than a guess.
 */
export function salvageDraft(text: string): Record<string, unknown> {
  const sections: Record<string, unknown> = {};
  for (const key of MODEL_SECTIONS) {
    const match = new RegExp(`"${key}"\\s*:\\s*\\{`).exec(text);
    const raw = match ? balanced(text, match.index + match[0].length - 1) : null;
    if (!raw) continue;
    try {
      sections[key] = JSON.parse(raw);
    } catch {
      /* a malformed section stays a gap */
    }
  }
  const out: Record<string, unknown> = { sections };
  const team = /"team_roles"\s*:\s*\[/.exec(text);
  const roles = team ? balanced(text, team.index + team[0].length - 1) : null;
  if (roles) {
    try {
      out["team_roles"] = JSON.parse(roles);
    } catch {
      /* default roles */
    }
  }
  out["questions"] = [...text.matchAll(/\{\s*"question"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"default"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g)].map((match) => {
    try {
      return { question: JSON.parse(`"${match[1]}"`), default: JSON.parse(`"${match[2]}"`) };
    } catch {
      return {};
    }
  });
  return out;
}

/** Sections whose text names another client, to redraft once. */
export function namedSections(sections: readonly DraftSection[], terms: readonly NameTerm[]): ProposalSectionKey[] {
  return sections.filter((section) => section.status !== "gap" && findNames(section.body, terms).length > 0).map((section) => section.key);
}

/** A section that still names another client after its redraft becomes a gap. */
export function blockSection(section: DraftSection): DraftSection {
  return { ...section, body: GAP_LINE, status: "gap", sources: [], flags: [] };
}

/** The new-client sentences a check found that the notes do not state, marked on the sections that hold them. */
export function markNewFacts(sections: readonly DraftSection[], sentences: readonly string[]): { sections: DraftSection[]; count: number } {
  let count = 0;
  const out = sections.map((section) => {
    const hits = sentences.filter((sentence) => sentence.length >= 12 && section.body.includes(sentence));
    count += hits.length;
    return hits.length ? { ...section, flags: [...section.flags, ...hits.map((hit) => `${DRAFT_COPY.factFlag} "${hit}"`)] } : section;
  });
  return { sections: out, count };
}

export type DraftStatus = { unconfirmed: number; questions: number; feeSet: false; ready: false };

/** The status strip. A draft is never ready here: the fee is always the partner's to set, outside this draft. */
export function draftStatus(draft: Pick<ProposalDraft, "sections" | "questions">): DraftStatus {
  return { unconfirmed: draft.sections.filter((section) => section.status !== "confirmed").length, questions: draft.questions.length, feeSet: false, ready: false };
}

/** The questions as a block the owner copies into their own message. */
export function questionsText(questions: readonly DraftQuestion[]): string {
  return questions.map((question, index) => `${index + 1}. ${question.text} (${DRAFT_COPY.defaultLabel}: ${question.fallback})`).join("\n");
}

function sourceLine(source: DraftSource): string {
  if (source.kind === "structure") return `- ${DRAFT_COPY.structureFrom(source.boardTitle)}`;
  if (source.shared === false) return `- ${DRAFT_COPY.noLongerShared}`;
  return `- ${DRAFT_COPY.factFrom(source.itemTitle)}: "${source.quote}"`;
}

/** The card's text. The fee keeps its own "## Fees" heading, so fee-withholding readers treat it like every proposal. */
export function renderProposalMarkdown(title: string, draft: Pick<ProposalDraft, "sections" | "questions">): string {
  const parts = [`# ${title}`, ""];
  for (const section of draft.sections) {
    const label = section.status === "confirmed" ? DRAFT_COPY.confirmed : section.status === "gap" ? DRAFT_COPY.gap : DRAFT_COPY.notReviewed;
    parts.push(`## ${section.heading}`, `_${label}_`, "", section.body, "");
    for (const flag of section.flags) parts.push(`> ${flag}`);
    if (section.sources.length) parts.push("Sources:", ...section.sources.map(sourceLine));
    parts.push("");
  }
  if (draft.questions.length) parts.push(`## ${DRAFT_COPY.questionsTitle}`, questionsText(draft.questions), "");
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** A stored draft from an item's meta, or null. */
export function storedDraft(meta: unknown): ProposalDraft | null {
  const value = meta && typeof meta === "object" ? (meta as Record<string, unknown>)["proposal_draft"] : null;
  if (!value || typeof value !== "object") return null;
  const draft = value as ProposalDraft;
  return Array.isArray(draft.sections) && Array.isArray(draft.questions) ? draft : null;
}

/** Fact sources re-checked against what the reader can see now: a board no longer shared hides its quote. */
export function recheckSources(draft: ProposalDraft, visibleItemIds: ReadonlySet<string>): ProposalDraft {
  return {
    ...draft,
    sections: draft.sections.map((section) => ({
      ...section,
      sources: section.sources.map((source) =>
        source.kind === "fact" && !visibleItemIds.has(source.itemId) ? { ...source, quote: "", shared: false } : source.kind === "fact" ? { ...source, shared: true } : source,
      ),
    })),
  };
}
