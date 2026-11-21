/**
 * 21 Nov 2026, chat pill PR 4b (D-97): what a proposal's Lead sees. A Lead is a teammate with a login linked to the
 * People row picked as the proposal's lead (PR 4a). They read the proposals they lead while open: the brief (the
 * salesperson's notes), the documents once the person who started it sends them, past work for the client from
 * boards shared with the firm, and the clock. The pure rules and words; nothing here reads or writes.
 *
 * Privacy floors:
 *   * Only the linked teammate reads a proposal as its Lead; unlinking or changing the lead ends it on the next read.
 *   * Context documents are the owner's own. Their titles and words reach the Lead only after the owner presses
 *     "Send the documents", and only while that same person is still the lead.
 *   * Past work comes only from boards shared with the firm (titles only), never an unshared board.
 *   * A Member who leads never sees money: amounts in the brief and in documents are withheld.
 *   * No person is scored or ranked; the order is the clock's, the same for everyone.
 */
import { timeLeft, type TimeLeft } from "./proposal-desk-shared";

/** One document on a proposal, as the Lead may open it. */
export type LeadDocument = { id: string; title: string };

/** A board shared with the firm for the same client. Title only. */
export type LeadPastWork = { boardId: string; title: string };

export type LedProposal = {
  id: string;
  title: string;
  clientName: string;
  /** Who started it, by name. */
  ownerName: string;
  receivedAt: string;
  sentAt: string | null;
  dueOn: string | null;
  /** The salesperson's notes, with amounts withheld for a Member. Null when there are none. */
  brief: string | null;
  /** Null until the person who started it sends the documents to this lead. */
  documents: LeadDocument[] | null;
  /** How many documents the proposal has, sent or not. A count only. */
  documentCount: number;
  pastWork: LeadPastWork[];
};

export type LedList = { goalHours: number; proposals: LedProposal[] };

/** The most of a document's words the Lead's reader shows. */
export const LEAD_DOC_MAX_CHARS = 50_000;

/** The most past work shown for one proposal. */
export const LEAD_PAST_WORK_SHOWN = 3;

/** Up next first: the one closest to (or furthest over) its goal, then the rest in the same order. Sent ones last. */
export function upNextOrder(rows: readonly LedProposal[], goalHours: number, now: Date = new Date()): LedProposal[] {
  const rank = (left: TimeLeft): number =>
    left.state === "over" ? -left.hoursOver : left.state === "running" ? left.hoursLeft : 1_000_000;
  return [...rows].sort((a, b) => {
    const diff = rank(timeLeft({ receivedAt: a.receivedAt, sentAt: a.sentAt, goalHours, now })) - rank(timeLeft({ receivedAt: b.receivedAt, sentAt: b.sentAt, goalHours, now }));
    return diff !== 0 ? diff : a.receivedAt.localeCompare(b.receivedAt);
  });
}

/** Whether the documents were sent to this lead: sent to the same People row that is the lead now. */
export function docsSentToLead(row: { lead_contact_id?: string | null; lead_docs_to?: string | null }): boolean {
  return Boolean(row.lead_contact_id) && row.lead_docs_to === row.lead_contact_id;
}

/* Inputs: shape only. The handlers decide. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value: unknown): string | null => (typeof value === "string" && UUID.test(value.trim()) ? value.trim().toLowerCase() : null);
type Loose = Record<string, unknown> | null | undefined;

export type LedInput = { profile_id: string | null };
export function ledInput(raw: unknown): LedInput {
  return { profile_id: id((raw as Loose)?.["profile_id"]) };
}

export type LeadDocInput = { profile_id: string | null; proposal_id: string; work_item_id: string };
export function leadDocInput(raw: unknown): LeadDocInput {
  const value = raw as Loose;
  const proposal = id(value?.["proposal_id"]);
  const item = id(value?.["work_item_id"]);
  if (!proposal || !item) throw new Error(LEAD_VIEW_COPY.docGone);
  return { profile_id: id(value?.["profile_id"]), proposal_id: proposal, work_item_id: item };
}

export type LeadDocResult = { ok: true; title: string; text: string; withheld: boolean } | { ok: false; problem: string };

export type SendDocsInput = { profile_id: string | null; proposal_id: string; send: boolean };
export function sendDocsInput(raw: unknown): SendDocsInput {
  const value = raw as Loose;
  const proposal = id(value?.["proposal_id"]);
  if (!proposal) throw new Error(SEND_DOCS_COPY.failed);
  return { profile_id: id(value?.["profile_id"]), proposal_id: proposal, send: value?.["send"] !== false };
}
export type SendDocsResult = { ok: true } | { ok: false; problem: string };

export const LEAD_VIEW_COPY = {
  title: "Up next",
  intro: (count: number) => (count === 1 ? "The proposal you lead." : `The ${count} proposals you lead, closest to the goal first.`),
  for: (client: string) => `For ${client}`,
  startedBy: (name: string) => `Started by ${name}`,
  brief: "The brief",
  noBrief: "No notes yet from the person who started it.",
  documents: "Documents",
  noDocuments: "No documents on this proposal yet.",
  notSent: (count: number, owner: string) =>
    `${count === 1 ? "1 document" : `${count} documents`} on this proposal. ${owner || "The person who started it"} sends them to you when they are ready.`,
  open: (title: string) => `Open ${title}`,
  pastWork: "Past work for this client",
  noPastWork: "No past work for this client is shared with the firm yet.",
  due: (day: string) => `Client wants it by ${day}`,
  loading: "Loading what you lead",
  loadFailed: "What you lead could not be loaded. Try again in a moment.",
  retry: "Try again",
  docLoading: "Opening the document",
  docGone: "That document is not here for you any more. It may have been taken off the proposal, or you may no longer lead it.",
  docFailed: "The document could not be opened. Try again in a moment.",
  withheld: "Amounts are withheld for you.",
  clipped: "This is the start of a long document. The rest opens on the team board once the proposal is won.",
  close: "Close",
  /** In the chat pill, one line above the welcome. */
  pill: (client: string, clock: string) => `Up next: ${client}. ${clock}.`,
  pillOpen: "See it on Home",
} as const;

export const SEND_DOCS_COPY = {
  send: (first: string) => (first ? `Send ${first} the documents` : "Send the lead the documents"),
  sent: (first: string) => (first ? `${first} can open the documents` : "The lead can open the documents"),
  stop: "Stop sharing",
  working: "Saving",
  /** Said before the press. */
  what: (first: string) =>
    `${first || "The lead"} will be able to open this proposal's documents and see their titles. Nobody else is given them. Nothing is texted or emailed.`,
  noLogin: (first: string) => `${first || "The lead"} has no login here, so there is nowhere to send them. Pick a teammate as lead to share documents.`,
  noLead: "Pick a lead first.",
  noDocs: "There are no documents on this proposal yet.",
  ownerOnly: "Only the person who started this proposal can send its documents.",
  closed: "This proposal is already decided.",
  notReady: "Sending documents to a lead works once the latest database update is in.",
  failed: "That could not be saved. Nothing changed. Try again in a moment.",
} as const;

/** The clock line, in the same words as the Proposals page. */
export { timeLeft, timeLeftLine } from "./proposal-desk-shared";
