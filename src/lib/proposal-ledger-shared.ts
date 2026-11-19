/**
 * The proposal ledger (Firm Brain Build Spec step 9): the record behind the "Value so far" line. One row per proposal
 * event, per board, with dates and counts only; the fee sits in its own table that only admins and leads read. Rule:
 * per proposal, never per person. Neither table has a person column, and nothing here reads one.
 *
 * Everything in this file is pure. valueSoFar computes every figure from ledger rows alone and returns each with the
 * ids of the rows behind it, so a number can always be opened to the rows that made it.
 */

import { countGrades, type RedPenClaim } from "./red-pen-shared";
import type { ProposalDraft } from "./proposal-draft-shared";
import { canSetFees, parseFee } from "./sow-terms-shared";

export const LEDGER_KINDS = ["brief_received", "draft_completed", "questions_sent", "answers_received", "sent_to_client", "won", "lost", "red_pen_run"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

/** Steps a person dates. The other two kinds are written only by the draft and Red pen server paths. */
export const HUMAN_KINDS = ["brief_received", "questions_sent", "answers_received", "sent_to_client", "won", "lost"] as const;
export type HumanKind = (typeof HUMAN_KINDS)[number];
export const OUTCOME_KINDS = ["won", "lost"] as const;

export function isHumanKind(kind: unknown): kind is HumanKind {
  return typeof kind === "string" && (HUMAN_KINDS as readonly string[]).includes(kind);
}

/** The columns every read names. There is no person column to leave out, and none may be added. */
export const LEDGER_COLUMNS = "id, engagement_id, kind, occurred_at, source_ref, sections_total, sections_sourced, questions_prepared, claims_unsupported";
export const LEDGER_VALUE_COLUMNS = "engagement_id, amount, currency";

export type LedgerRow = {
  id: string;
  engagement_id: string;
  kind: LedgerKind;
  occurred_at: string;
  source_ref: string | null;
  sections_total: number | null;
  sections_sourced: number | null;
  questions_prepared: number | null;
  claims_unsupported: number | null;
};

export type LedgerValueRow = { engagement_id: string; amount: number; currency: string };

/** The same codes the fee parser reads, so a value is entered the way fee terms are. */
export const LEDGER_CURRENCIES = ["USD", "GBP", "EUR", "AUD", "CAD", "NZD", "CHF", "SGD"] as const;
export type LedgerCurrency = (typeof LEDGER_CURRENCIES)[number];
/** numeric(14, 2) in the database; kept well inside it. */
export const MAX_LEDGER_AMOUNT = 99_999_999_999;
export const MAX_AMOUNT_CHARS = 40;

export const LEDGER_KIND_LABELS: Record<LedgerKind, string> = {
  brief_received: "Brief received",
  draft_completed: "First draft",
  questions_sent: "Questions sent",
  answers_received: "Answers back",
  sent_to_client: "Sent to client",
  won: "Won",
  lost: "Lost",
  red_pen_run: "Red pen run",
};

export const LEDGER_COPY = {
  title: "Value so far",
  firmTitle: "Proposals: value so far",
  firmLine: "Built only from the proposal ledger: dates and counts recorded on each proposal. Counted per proposal, never per person.",
  firmUnshared: "Proposals on boards that are not shared with the firm are not counted.",
  firmEmpty: "No proposal on a board shared with the firm has anything recorded yet.",
  empty: "Nothing is recorded for this proposal yet. The brief date and the first draft are recorded as they happen.",
  unsharedNote: "This board is not shared with the firm, so the firm's figure does not count it.",
  loading: "Loading.",
  loadFailed: "Could not load the value so far.",
  retry: "Try again",
  notRecorded: "Not recorded",
  setDate: "Set date",
  change: "Change",
  remove: "Remove",
  save: "Save",
  cancel: "Cancel",
  dateLabel: (label: string) => `${label}: date`,
  outcome: "Outcome",
  notDecided: "Not decided",
  markWon: "Mark as won",
  markLost: "Mark as lost",
  finishedHint: "How it ended says this engagement ran. If the proposal was won, mark it here.",
  refused: "Could not save. Only people who can edit this board can record a step.",
  failed: "Could not save. Try again.",
  futureDate: "Pick today or an earlier date.",
  badDate: "Enter a real date.",
  needBrief: "Record when the brief arrived, or draft the proposal, before recording this step.",
  secondOutcome: (current: "won" | "lost", next: "won" | "lost") => `This proposal is already marked ${current}. Remove that before marking it ${next}.`,
  unknownStep: "That step cannot be recorded by hand.",
  valueLabel: "Value",
  valueNotSet: "Not set",
  setValue: "Set value",
  amountLabel: "Proposal value",
  amountPlaceholder: "380k",
  currencyLabel: "Currency",
  removeValue: "Remove value",
  valueHelper: "The total value of this proposal. Only admins and leads see it.",
  valueWriteOnly: "You can set the value here. It shows to the board's owner if they are an admin or lead, and to admins and leads once the board is shared with the firm.",
  valueSaved: (text: string) => `Saved: ${text}.`,
  valueRefused: "Could not save. Only admins and leads set a proposal's value.",
  needAmount: "Enter the value as a figure, for example 380k or 1.2m.",
  badAmount: "Enter one plain figure, for example 380k, 1.2m or 45,000. No ranges.",
  monthlyAmount: "Enter the total value, not a monthly figure.",
  tooLarge: "That figure is too large.",
  badCurrency: "Pick a currency from the list.",
  currencyMismatch: (written: string, picked: string) => `The amount says ${written} but the currency is ${picked}. Make them match.`,
  notProposal: "Start the proposal on this board before setting its value.",
  trace: "The rows behind this number",
  noRows: "No rows.",
  openDraft: "Open the draft",
  openRedPen: "Open Red pen",
  markQuestionsSent: "Mark questions as sent",
  questionsMarked: "Marked as sent today. Change the date under Value so far.",
  questionsMarkFailed: "Could not mark the questions as sent.",
} as const;

/* ---------------------------------------------------------------------------
 * Machine rows: counts taken in code from what was saved, never from model text.
 * ------------------------------------------------------------------------- */

const SMALLINT_MAX = 32_767;
const small = (count: number) => Math.max(0, Math.min(SMALLINT_MAX, Math.trunc(count)));

/** A section "arrived sourced" when it is not a gap and carries at least one source the draft checks kept. */
export function draftLedgerCounts(draft: Pick<ProposalDraft, "sections" | "questions">): { sections_total: number; sections_sourced: number; questions_prepared: number } {
  const sections = Array.isArray(draft.sections) ? draft.sections : [];
  const questions = Array.isArray(draft.questions) ? draft.questions : [];
  const total = small(sections.length);
  const sourced = small(sections.filter((section) => section.status !== "gap" && Array.isArray(section.sources) && section.sources.length > 0).length);
  return { sections_total: total, sections_sourced: Math.min(sourced, total), questions_prepared: small(questions.length) };
}

/** Unsupported claims in a Red pen result, counted again from the stored grades. */
export function redPenLedgerCount(claims: readonly RedPenClaim[]): number {
  return small(countGrades(Array.isArray(claims) ? claims : []).unsupported);
}

/* ---------------------------------------------------------------------------
 * Dates a person enters.
 * ------------------------------------------------------------------------- */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** The latest calendar date anywhere on Earth right now: UTC plus 14 hours. */
export function latestToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 14 * 3_600_000).toISOString().slice(0, 10);
}

/** A problem to show, or null when the date can be saved. */
export function checkStepDate(date: unknown, now: Date = new Date()): string | null {
  if (typeof date !== "string" || !DATE.test(date)) return LEDGER_COPY.badDate;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < "2000-01-01") return LEDGER_COPY.badDate;
  if (date > latestToday(now)) return LEDGER_COPY.futureDate;
  return null;
}

/** A date-only step is stored at noon UTC, so its calendar date reads the same in every time zone. */
export function stepInstant(date: string): string {
  return `${date}T12:00:00.000Z`;
}

/** The calendar date of a row. */
export function ledgerDay(iso: string): string {
  return iso.slice(0, 10);
}

/** "12 Nov 2026", read as a calendar date so no time zone moves it. */
export function ledgerDate(iso: string): string {
  const [y, m, d] = ledgerDay(iso).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${ledgerDay(to)}T00:00:00.000Z`) - Date.parse(`${ledgerDay(from)}T00:00:00.000Z`)) / 86_400_000);
}

/* ---------------------------------------------------------------------------
 * Value: parsed by code with the parser fee terms use. Never typed by a model.
 * ------------------------------------------------------------------------- */

const DOLLARS: readonly string[] = ["USD", "AUD", "CAD", "NZD", "SGD"];

/** The currencies a written mark could mean, or null when the text carries no mark. */
function writtenCurrencies(text: string): { label: string; codes: readonly string[] } | null {
  const code = /\b(USD|GBP|EUR|AUD|CAD|NZD|CHF|SGD)\b/i.exec(text)?.[1]?.toUpperCase();
  if (code) return { label: code, codes: [code] };
  if (/£|pounds?/i.test(text)) return { label: "pounds", codes: ["GBP"] };
  if (/€|euros?/i.test(text)) return { label: "euros", codes: ["EUR"] };
  if (/\$|dollars?/i.test(text)) return { label: "dollars", codes: DOLLARS };
  return null;
}

export type ParsedAmount = { ok: true; amount: number; currency: LedgerCurrency } | { ok: false; problem: string };

/** One plain total in a listed currency ("380k", "$1.2m", "£45,000", "USD 90,000"). Anything else is refused. */
export function parseLedgerAmount(text: unknown, currency: unknown): ParsedAmount {
  if (typeof currency !== "string" || !(LEDGER_CURRENCIES as readonly string[]).includes(currency)) return { ok: false, problem: LEDGER_COPY.badCurrency };
  const clean = typeof text === "string" ? text.trim().replace(/\s+/g, " ") : "";
  if (!clean) return { ok: false, problem: LEDGER_COPY.needAmount };
  if (clean.length > MAX_AMOUNT_CHARS) return { ok: false, problem: LEDGER_COPY.badAmount };
  const written = writtenCurrencies(clean);
  if (written && !written.codes.includes(currency)) return { ok: false, problem: LEDGER_COPY.currencyMismatch(written.label, currency) };
  const parsed = parseFee(written ? clean : `${currency} ${clean}`);
  if (parsed.fee_amount === null) return { ok: false, problem: LEDGER_COPY.badAmount };
  if (parsed.fee_basis === "monthly") return { ok: false, problem: LEDGER_COPY.monthlyAmount };
  if (parsed.fee_amount > MAX_LEDGER_AMOUNT) return { ok: false, problem: LEDGER_COPY.tooLarge };
  return { ok: true, amount: parsed.fee_amount, currency: currency as LedgerCurrency };
}

/** "USD 380,000": the code, never a symbol, so two dollar currencies are never confused. */
export function formatLedgerAmount(amount: number, currency: string): string {
  return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
}

/* ---------------------------------------------------------------------------
 * Who sees what. The database decides the rows; this mirrors it so the screen can say so.
 * ------------------------------------------------------------------------- */

export type LedgerAccess = "owner" | "partner" | "none";

/** Dates and counts: the board's owner, and admins and leads while the board is shared with the firm. */
export function ledgerAccess(input: { role: string | null | undefined; isOwner: boolean; shared: boolean; archived: boolean }): LedgerAccess {
  if (!input.role || input.role === "coach") return "none";
  if (input.isOwner) return "owner";
  return canSetFees(input.role) && input.shared && !input.archived ? "partner" : "none";
}

/** The value: admins and leads only, never an em owner. */
export function canSeeLedgerValue(role: string | null | undefined, access: LedgerAccess): boolean {
  return canSetFees(role) && access !== "none";
}

/** Setting the value: an admin or lead who owns the board, can edit it, or sees it because it is shared. */
export function canSetLedgerValue(input: { role: string | null | undefined; isOwner: boolean; isEditor: boolean; shared: boolean; archived: boolean }): boolean {
  return canSetFees(input.role) && (input.isOwner || input.isEditor || (input.shared && !input.archived));
}

/* ---------------------------------------------------------------------------
 * The figures. Every one carries the ids of the ledger rows behind it.
 * ------------------------------------------------------------------------- */

export type Traced<T> = { value: T; rowIds: string[] };

export type ValueWon = { currency: string; amount: number; rowIds: string[]; boardIds: string[] };

export type ValueSoFar = {
  /** No ledger row at all. */
  empty: boolean;
  /** Proposals with a brief or a first draft recorded. */
  proposals: Traced<number>;
  /** Days from the brief to the first draft. One proposal shows its own days; several show a median. */
  briefToDraft: Traced<{ days: number; basis: "one" | "median"; proposals: number } | null>;
  /** Sections of each proposal's first draft that arrived with a source. */
  sourced: Traced<{ sourced: number; total: number } | null>;
  questionsPrepared: Traced<number>;
  /** Unsupported claims Red pen flagged, with the number of runs they came from. */
  claimsCaught: Traced<{ claims: number; runs: number }>;
  questionsSent: Traced<number>;
  answersBack: Traced<number>;
  sent: Traced<number>;
  won: Traced<number>;
  lost: Traced<number>;
  /** Present only when the reader may see fees. One entry per currency; never summed across currencies. */
  valueWon?: ValueWon[];
};

const byTime = (a: LedgerRow, b: LedgerRow) => a.occurred_at.localeCompare(b.occurred_at) || a.id.localeCompare(b.id);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Every figure on the "Value so far" line, from ledger rows alone. Pass values as null when the reader may not see
 * fees: the result then has no value key at all. Nothing is grouped by owner, because no row says who.
 */
export function valueSoFar(rows: readonly LedgerRow[], values: readonly LedgerValueRow[] | null): ValueSoFar {
  const ordered = [...rows].sort(byTime);
  const of = (kind: LedgerKind) => ordered.filter((row) => row.kind === kind);
  const ids = (list: readonly LedgerRow[]) => list.map((row) => row.id);
  const boards = (list: readonly LedgerRow[]) => new Set(list.map((row) => row.engagement_id)).size;

  const briefs = of("brief_received");
  const drafts = of("draft_completed");
  const started = [...briefs, ...drafts];

  // Each proposal's first draft: later drafts on the same board never count twice.
  const firstDraft = new Map<string, LedgerRow>();
  for (const draft of drafts) if (!firstDraft.has(draft.engagement_id)) firstDraft.set(draft.engagement_id, draft);
  const firsts = [...firstDraft.values()];

  const timed: { days: number; rows: LedgerRow[] }[] = [];
  for (const brief of briefs) {
    const draft = firstDraft.get(brief.engagement_id);
    if (!draft) continue;
    const days = daysBetween(brief.occurred_at, draft.occurred_at);
    // A brief dated after its own draft is a correction still to make; it is left out, never shown as negative.
    if (days >= 0) timed.push({ days, rows: [brief, draft] });
  }

  const counted = firsts.filter((row) => row.sections_total !== null);
  const total = counted.reduce((sum, row) => sum + (row.sections_total ?? 0), 0);
  const sourcedCount = counted.reduce((sum, row) => sum + (row.sections_sourced ?? 0), 0);
  const asked = firsts.filter((row) => row.questions_prepared !== null);
  const runs = of("red_pen_run");
  const count = (kind: LedgerKind): Traced<number> => ({ value: boards(of(kind)), rowIds: ids(of(kind)) });
  const wonRows = of("won");

  const result: ValueSoFar = {
    empty: rows.length === 0,
    proposals: { value: boards(started), rowIds: ids(started) },
    briefToDraft: {
      value: timed.length ? { days: timed.length === 1 ? timed[0]!.days : median(timed.map((entry) => entry.days)), basis: timed.length === 1 ? "one" : "median", proposals: timed.length } : null,
      rowIds: timed.flatMap((entry) => ids(entry.rows)),
    },
    sourced: { value: total > 0 ? { sourced: sourcedCount, total } : null, rowIds: total > 0 ? ids(counted) : [] },
    questionsPrepared: { value: asked.reduce((sum, row) => sum + (row.questions_prepared ?? 0), 0), rowIds: ids(asked) },
    claimsCaught: { value: { claims: runs.reduce((sum, row) => sum + (row.claims_unsupported ?? 0), 0), runs: runs.length }, rowIds: ids(runs) },
    questionsSent: count("questions_sent"),
    answersBack: count("answers_received"),
    sent: count("sent_to_client"),
    won: count("won"),
    lost: count("lost"),
  };

  if (values) {
    const byCurrency = new Map<string, ValueWon>();
    for (const won of wonRows) {
      const value = values.find((entry) => entry.engagement_id === won.engagement_id);
      if (!value) continue;
      const entry = byCurrency.get(value.currency) ?? { currency: value.currency, amount: 0, rowIds: [], boardIds: [] };
      entry.amount += Number(value.amount);
      entry.rowIds.push(won.id);
      entry.boardIds.push(won.engagement_id);
      byCurrency.set(value.currency, entry);
    }
    result.valueWon = [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  }
  return result;
}

/* ---------------------------------------------------------------------------
 * The figures as lines a person reads. One list for both surfaces, so the board and the firm card never disagree.
 * ------------------------------------------------------------------------- */

export type LedgerFigureLine = { key: string; text: string; rowIds: string[] };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function daysText(days: number): string {
  if (days === 0) return "the same day";
  return `${Number.isInteger(days) ? days : days.toFixed(1)} ${days === 1 ? "day" : "days"}`;
}

/**
 * scope "board" leaves out the step counts (the timeline shows those dates) and never says median for one proposal;
 * scope "firm" counts proposals. A figure with nothing behind it is left out, never shown as zero progress.
 */
export function ledgerFigureLines(figures: ValueSoFar, scope: "board" | "firm"): LedgerFigureLine[] {
  const lines: LedgerFigureLine[] = [];
  const add = (key: string, text: string, rowIds: string[]) => lines.push({ key, text, rowIds });
  if (scope === "firm" && figures.proposals.value > 0) add("proposals", `${plural(figures.proposals.value, "proposal", "proposals")} started`, figures.proposals.rowIds);
  const timing = figures.briefToDraft.value;
  if (timing) {
    add(
      "briefToDraft",
      timing.basis === "one"
        ? timing.days === 0
          ? "Brief to first draft: the same day"
          : `Brief to first draft: ${daysText(timing.days)}`
        : `Median from brief to first draft: ${daysText(timing.days)}, across ${timing.proposals} proposals`,
      figures.briefToDraft.rowIds,
    );
  }
  const sourced = figures.sourced.value;
  if (sourced) {
    const share = scope === "firm" ? ` (${Math.round((sourced.sourced / sourced.total) * 100)}%)` : "";
    add("sourced", `${sourced.sourced} of ${plural(sourced.total, "section", "sections")} arrived with a source${share}`, figures.sourced.rowIds);
  }
  if (figures.questionsPrepared.rowIds.length) add("questionsPrepared", `${plural(figures.questionsPrepared.value, "question", "questions")} prepared for the lead`, figures.questionsPrepared.rowIds);
  const caught = figures.claimsCaught.value;
  if (caught.runs > 0) add("claimsCaught", `${plural(caught.claims, "unsupported claim", "unsupported claims")} flagged by Red pen, across ${plural(caught.runs, "run", "runs")}`, figures.claimsCaught.rowIds);
  if (scope === "firm") {
    if (figures.questionsSent.value) add("questionsSent", `${figures.questionsSent.value} with questions sent`, figures.questionsSent.rowIds);
    if (figures.answersBack.value) add("answersBack", `${figures.answersBack.value} with answers back`, figures.answersBack.rowIds);
    if (figures.sent.value) add("sent", `${figures.sent.value} sent to the client`, figures.sent.rowIds);
    if (figures.won.value) add("won", `${figures.won.value} won`, figures.won.rowIds);
    if (figures.lost.value) add("lost", `${figures.lost.value} lost`, figures.lost.rowIds);
    for (const value of figures.valueWon ?? []) add(`valueWon-${value.currency}`, `Value won: ${formatLedgerAmount(value.amount, value.currency)}`, value.rowIds);
  }
  return lines;
}

/** What one row says in a trace: its date, its kind, and its own counts. */
export function ledgerRowLine(row: LedgerRow): string {
  const parts = [ledgerDate(row.occurred_at), LEDGER_KIND_LABELS[row.kind] ?? row.kind];
  if (row.kind === "draft_completed" && row.sections_total !== null) {
    parts.push(`${row.sections_sourced ?? 0} of ${plural(row.sections_total, "section", "sections")} sourced`);
    if (row.questions_prepared !== null) parts.push(plural(row.questions_prepared, "question", "questions"));
  }
  if (row.kind === "red_pen_run" && row.claims_unsupported !== null) parts.push(plural(row.claims_unsupported, "unsupported claim", "unsupported claims"));
  return parts.join(" · ");
}

/** This proposal's dated steps in order, for the board timeline. A step with no row has a null date. */
export type TimelineStep = { kind: Exclude<LedgerKind, "red_pen_run" | "won" | "lost">; rowId: string | null; date: string | null; editable: boolean };

export function boardTimeline(rows: readonly LedgerRow[]): { steps: TimelineStep[]; outcome: { kind: "won" | "lost"; rowId: string; date: string } | null } {
  const ordered = [...rows].sort(byTime);
  const first = (kind: LedgerKind) => ordered.find((row) => row.kind === kind) ?? null;
  const kinds: TimelineStep["kind"][] = ["brief_received", "draft_completed", "questions_sent", "answers_received", "sent_to_client"];
  const steps = kinds.map((kind) => {
    const row = first(kind);
    return { kind, rowId: row?.id ?? null, date: row ? ledgerDay(row.occurred_at) : null, editable: kind !== "draft_completed" };
  });
  const end = ordered.find((row) => row.kind === "won" || row.kind === "lost");
  return { steps, outcome: end ? { kind: end.kind as "won" | "lost", rowId: end.id, date: ledgerDay(end.occurred_at) } : null };
}

/* ---------------------------------------------------------------------------
 * What the server returns. No field names a person.
 * ------------------------------------------------------------------------- */

export type LedgerSourceLink = { itemId: string; title: string; as: "draft" | "red_pen" };

export type BoardValueSoFar = {
  scope: "board";
  access: LedgerAccess;
  /** May record or correct this proposal's steps. */
  canEdit: boolean;
  canSeeValue: boolean;
  canSetValue: boolean;
  shared: boolean;
  /** How it ended has an outcome, so the engagement ran. */
  finished: boolean;
  figures: ValueSoFar;
  rows: LedgerRow[];
  /** Row id to the draft or Red pen deliverable it came from, where the reader can open it. */
  sources: Record<string, LedgerSourceLink>;
  /** Present only when canSeeValue. */
  value?: { amount: number; currency: string } | null;
};

export type FirmValueSoFar = { scope: "firm"; figures: ValueSoFar; rows: LedgerRow[] };

export type StepResult = { ok: true; row: { id: string; kind: HumanKind; occurred_at: string } } | { ok: false; problem: string };
export type ValueResult = { ok: true; value: { amount: number; currency: string } | null } | { ok: false; problem: string };

/* ---------------------------------------------------------------------------
 * What a server function accepts. Anything that is not a board id is refused before a handler runs.
 * ------------------------------------------------------------------------- */

const UUID_INPUT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Loose = Record<string, unknown> | null | undefined;
const text = (value: unknown): string => (typeof value === "string" ? value : "");

export type LedgerProfileInput = { profile_id: string | null };
export type LedgerBoardInput = LedgerProfileInput & { engagement_id: string };
export type LedgerStepInput = LedgerBoardInput & { kind: string; date: string };
export type LedgerValueInput = LedgerBoardInput & { amount_text: string; currency: string; clear: boolean };
export type LedgerShownInput = LedgerBoardInput & { item_id: string };

export function ledgerProfileInput(input: { profile_id?: string | null | undefined } | undefined): LedgerProfileInput {
  const profileId = text((input as Loose)?.["profile_id"]).trim();
  return { profile_id: UUID_INPUT.test(profileId) ? profileId : null };
}

export function ledgerBoardInput(input: { engagement_id: string; profile_id?: string | null | undefined }): LedgerBoardInput {
  const id = text((input as Loose)?.["engagement_id"]).trim();
  if (!UUID_INPUT.test(id)) throw new Error("Unknown board.");
  return { ...ledgerProfileInput(input), engagement_id: id };
}

export function ledgerStepInput(input: { engagement_id: string; kind: string; date?: string | undefined; profile_id?: string | null | undefined }): LedgerStepInput {
  return { ...ledgerBoardInput(input), kind: text((input as Loose)?.["kind"]), date: text((input as Loose)?.["date"]) };
}

export function ledgerValueInput(input: { engagement_id: string; amount_text?: string | undefined; currency?: string | undefined; clear?: boolean | undefined; profile_id?: string | null | undefined }): LedgerValueInput {
  const loose = input as Loose;
  return { ...ledgerBoardInput(input), amount_text: text(loose?.["amount_text"]), currency: text(loose?.["currency"]), clear: loose?.["clear"] === true };
}

export function ledgerShownInput(input: { engagement_id: string; item_id: string; profile_id?: string | null | undefined }): LedgerShownInput {
  const itemId = text((input as Loose)?.["item_id"]).trim();
  if (!UUID_INPUT.test(itemId)) throw new Error("Unknown deliverable.");
  return { ...ledgerBoardInput(input), item_id: itemId };
}
