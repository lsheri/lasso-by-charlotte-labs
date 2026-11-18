/**
 * Start a proposal, step 1 (firm-brain-review RECOMMENDATION section 4): a short brief from the new board's notes,
 * up to three precedents from work shared with the firm, the firm's own client-shown proposals as "what good looks
 * like", and past fees for admins and leads. Pure parts, tested without a model. The model never sees or picks a fee:
 * fees are a list of comparables rendered by code from SOW terms, never a range, and fixed and monthly fees never
 * share a list.
 */

import { maskFees } from "./firm-ask-shared";
import type { FirmCorpus } from "./firm-corpus-shared";

export const PROPOSAL_BRIEF_FIELDS = ["client", "problem", "deadline", "decider", "size", "outOfScope"] as const;
export type ProposalBriefField = (typeof PROPOSAL_BRIEF_FIELDS)[number];
export type ProposalBrief = Record<ProposalBriefField, string>;
export const PROPOSAL_BRIEF_MAX = 200;
export const PRECEDENTS_MAX = 3;

export const PROPOSAL_COPY = {
  menuItem: "Start a proposal",
  title: "Start a proposal",
  intro: "Reads this board's notes into a short brief, then finds the closest past engagements shared with the firm. Nothing here is sent to anyone.",
  privateNote: "Drafting does not add this board to the firm's memory.",
  readNotes: "Read the notes",
  readingNotes: "Reading this board's notes",
  briefTitle: "Brief",
  briefHint: "Correct anything that is wrong. The precedents match on this.",
  findPrecedents: "Find precedents",
  finding: "Reading work shared with the firm",
  precedentsTitle: "Past engagements like this",
  close: "Close match",
  loose: "Loose match",
  noneFound: "No past engagement shared with the firm is close to this brief.",
  fewer: (count: number) => `${count} close ${count === 1 ? "match" : "matches"}.`,
  lastTime: "Last time",
  swap: "Swap for",
  goodTitle: "What good looks like",
  goodHint: "Proposals this firm showed a client.",
  feesTitle: "What we charged before",
  feesHint: "As written in each SOW. No suggested price: the partner sets the fee.",
  fixed: "Fixed fees",
  monthly: "Monthly fees",
  ranToPlan: "Ran to plan",
  overran: "Overran",
  extended: "Client extended",
  notExtended: "Not extended",
  active: "Still running",
  error: "That did not work. Try again.",
  closePanel: "Close",
} as const;

export const BRIEF_LABELS: Record<ProposalBriefField, string> = {
  client: "Client type",
  problem: "The problem",
  deadline: "Deadline",
  decider: "Who decides",
  size: "Rough size",
  outOfScope: "Out of scope",
};

export function emptyBrief(): ProposalBrief {
  return { client: "", problem: "", deadline: "", decider: "", size: "", outOfScope: "" };
}

/** A brief from untrusted input: every field a short single line, money masked so the model never reads a fee. */
export function cleanBrief(raw: unknown): ProposalBrief {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = emptyBrief();
  for (const field of PROPOSAL_BRIEF_FIELDS) {
    const value = source[field];
    out[field] = typeof value === "string" ? maskFees(value.replace(/\s+/g, " ").trim()).slice(0, PROPOSAL_BRIEF_MAX) : "";
  }
  return out;
}

export type ParsedOutcome = { ranToPlan: boolean | null; extended: boolean | null; lesson: string | null };

/** The close-out line ("Ran to plan. Client extended. <lesson>") as data; free text becomes the lesson. */
export function parseOutcome(outcome: string | null): ParsedOutcome {
  if (!outcome?.trim()) return { ranToPlan: null, extended: null, lesson: null };
  let rest = outcome.trim();
  let ranToPlan: boolean | null = null;
  let extended: boolean | null = null;
  const plan = /^(Ran to plan|Overran)\.\s*/i.exec(rest);
  if (plan) {
    ranToPlan = /^ran/i.test(plan[1]!);
    rest = rest.slice(plan[0].length);
  }
  const ext = /^(Client extended|Not extended)\.\s*/i.exec(rest);
  if (ext) {
    extended = /^client/i.test(ext[1]!);
    rest = rest.slice(ext[0].length);
  }
  return { ranToPlan, extended, lesson: rest.trim() || null };
}

export type Precedent = {
  boardId: string;
  title: string;
  client: string | null;
  closeness: "close" | "loose";
  why: string;
  /** The SOW's index card, money masked. */
  scope: string | null;
  weeks: number | null;
  active: boolean;
  ranToPlan: boolean | null;
  extended: boolean | null;
  lesson: string | null;
  /** The SOW item, to open in a preview. */
  sowItemId: string | null;
};

export function precedentView(corpus: FirmCorpus, pick: { boardId: string; closeness: "close" | "loose"; why: string }): Precedent | null {
  const board = corpus.boards.find((entry) => entry.id === pick.boardId);
  if (!board) return null;
  const sow = corpus.items.find((item) => item.boardId === board.id && item.sowFacts);
  const weeks = typeof sow?.sowFacts?.["weeks"] === "number" ? (sow.sowFacts["weeks"] as number) : null;
  const outcome = parseOutcome(board.outcome);
  return {
    boardId: board.id,
    title: board.title,
    client: board.client,
    closeness: pick.closeness,
    why: maskFees(pick.why).slice(0, 160),
    scope: sow?.summary ? maskFees(sow.summary) : null,
    weeks,
    active: !board.outcome,
    ranToPlan: outcome.ranToPlan,
    extended: outcome.extended,
    lesson: outcome.lesson ? maskFees(outcome.lesson) : null,
    sowItemId: sow?.id ?? null,
  };
}

export type GoodProposal = { itemId: string; title: string; boardTitle: string; shownOn: string };

/** The firm's proposals that were shown to a client, newest first. */
export function goodProposals(corpus: FirmCorpus): GoodProposal[] {
  return corpus.items
    .filter((item) => item.kind === "proposal" && item.shown.length > 0 && item.grade === "full")
    .map((item) => ({
      itemId: item.id,
      title: item.title,
      boardTitle: corpus.boards.find((board) => board.id === item.boardId)?.title ?? "",
      shownOn: item.shown.at(-1)!.on,
    }))
    .sort((a, b) => b.shownOn.localeCompare(a.shownOn));
}

export type PastFee = {
  boardId: string;
  title: string;
  fee: string;
  basis: "fixed" | "monthly";
  weeks: number | null;
  startedOn: string;
  ranToPlan: boolean | null;
  extended: boolean | null;
  sowItemId: string;
};

/**
 * Comparable fees for the given boards, as written in each SOW, for admins and leads only. Two separate lists so a
 * monthly retainer never sits beside fixed fees; no range or average is ever computed.
 */
export function pastFees(corpus: FirmCorpus, boardIds: readonly string[], canSeeFees: boolean): { fixed: PastFee[]; monthly: PastFee[] } {
  const fixed: PastFee[] = [];
  const monthly: PastFee[] = [];
  if (!canSeeFees) return { fixed, monthly };
  for (const boardId of new Set(boardIds)) {
    const board = corpus.boards.find((entry) => entry.id === boardId);
    const sow = corpus.items.find((item) => item.boardId === boardId && item.sowFacts);
    const facts = sow?.sowFacts;
    if (!board || !sow || !facts || typeof facts["fee_text"] !== "string") continue;
    const basis = facts["fee_basis"] === "monthly" ? "monthly" : facts["fee_basis"] === "fixed" ? "fixed" : null;
    if (!basis) continue;
    const outcome = parseOutcome(board.outcome);
    const row: PastFee = {
      boardId,
      title: board.title,
      fee: facts["fee_text"],
      basis,
      weeks: typeof facts["weeks"] === "number" ? facts["weeks"] : null,
      startedOn: board.startedOn,
      ranToPlan: outcome.ranToPlan,
      extended: outcome.extended,
      sowItemId: sow.id,
    };
    (basis === "fixed" ? fixed : monthly).push(row);
  }
  return { fixed, monthly };
}

/** Checks the model's precedent picks against the corpus: known boards, no repeats, at most three, close or loose. */
export function checkPicks(raw: unknown, corpus: FirmCorpus, exclude: readonly string[] = []): { boardId: string; closeness: "close" | "loose"; why: string }[] {
  const list = Array.isArray(raw) ? raw : [];
  const known = new Set(corpus.boards.map((board) => board.id));
  const seen = new Set(exclude);
  const out: { boardId: string; closeness: "close" | "loose"; why: string }[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const { board_id, closeness, why } = entry as Record<string, unknown>;
    if (typeof board_id !== "string" || !known.has(board_id) || seen.has(board_id)) continue;
    seen.add(board_id);
    out.push({ boardId: board_id, closeness: closeness === "close" ? "close" : "loose", why: typeof why === "string" ? why.trim() : "" });
    if (out.length >= PRECEDENTS_MAX) break;
  }
  // Close matches first.
  return out.sort((a, b) => (a.closeness === b.closeness ? 0 : a.closeness === "close" ? -1 : 1));
}
