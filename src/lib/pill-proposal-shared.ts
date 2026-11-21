/**
 * 20 Nov 2026, chat pill PR 3b (Liam, D-111): a brief pasted into the chat starts a proposal there. The pure rules:
 * telling a pasted brief from a question, who may start one in the chat, how the reading becomes New proposal's own
 * input (so the chat and the app's own New proposal button make exactly the same row), and the words.
 *
 * Admins and leads start proposals. A Member who pastes a brief is offered to pass it to an admin instead, which lands
 * in the admin's notifications. Nothing here reads a fee, a person's numbers or a score.
 */

import {
  BRIEF_READ_MAX,
  BRIEF_READ_MIN,
  dueOnOrNull,
  type BriefReading,
} from "./brief-read-shared";
import {
  MAX_TITLE_CHARS,
  sameClientName,
  type DeskClient,
  type NewProposalRaw,
} from "./proposal-desk-shared";

const STARTER = /^\s*(?:start a proposal|new proposal)\s*[:\-]\s*/i;

/**
 * A pasted brief rather than a question, as the prototype tells them apart: it says someone wants, needs or asked for
 * something, or names a brief, an RFP, a proposal or a due date, and it is not phrased as a question. A long paste of
 * several lines counts too. "Start a proposal:" in front always does.
 */
export function isBriefPaste(text: string): boolean {
  const clean = text.trim();
  if (clean.length < BRIEF_READ_MIN || clean.length > BRIEF_READ_MAX) return false;
  if (STARTER.test(clean)) return true;
  const lines = clean.split(/\n+/).filter((line) => line.trim()).length;
  const cue =
    /\b(wants?|needs?|would like|asked us|is looking for|rfp|request for proposal|brief|proposal|scope|due|by the \d)\b/i.test(
      clean,
    );
  // QA M1 of PR 296: a pasted email of several lines is a brief even with a question in it ("Could we send something
  // over by the 3rd?"), and so is asking us to put a proposal together.
  if (lines >= 3 && clean.length >= 120 && (cue || /^(hi|hello|dear|hey)\b/i.test(clean)))
    return true;
  if (
    /^(can|could|would|will)\s+(you|we|someone)\b[^?]*\b(put together|draft|write|start|prepare|send|do)\b[^?]*\b(proposal|rfp|bid|quote)\b/i.test(
      clean,
    )
  )
    return true;
  // A question, or an instruction to look something up, is asked of the firm.
  const question =
    /\?\s*$/.test(clean) ||
    /^(how|what|where|when|who|why|which|did|do|does|is|are|can|could|should|has|have|find|show|tell me|give me|summari[sz]e|list|explain|compare|past|any|look up|search)\b/i.test(
      clean,
    );
  if (question) return false;
  if (cue) return true;
  return lines >= 4 && clean.length >= 200;
}

/** The paste without a "Start a proposal:" in front. */
export function briefText(text: string): string {
  return text.trim().replace(STARTER, "").trim();
}

/**
 * Who may start a proposal in the chat: admins and leads, as the plan says. (Proposals' own New proposal button is open
 * to every company member today; only the chat sends a Member's paste to an admin instead.)
 */
export function mayStartInChat(role: string | null | undefined): boolean {
  return role === "admin" || role === "lead";
}

/** What the card holds once the person has checked it. */
export type BriefDraft = { client: string; ask: string; dueOn: string; workItemIds: string[] };

export function draftFrom(reading: BriefReading): BriefDraft {
  return {
    client: reading.client?.name ?? "",
    ask: (reading.ask ?? "").slice(0, MAX_TITLE_CHARS),
    dueOn: reading.due?.date ?? "",
    workItemIds: [],
  };
}

/**
 * The card's draft as New proposal's own input: an existing client by name when there is one (the firm's spelling),
 * otherwise a new name for an admin to add; the ask as the title; the whole paste as the notes; the due date only if
 * it is a real date. The server checks every part of it again.
 */
export function proposalInput(
  draft: BriefDraft,
  notes: string,
  clients: readonly DeskClient[],
  profileId: string,
): NewProposalRaw {
  const name = draft.client.replace(/\s+/g, " ").trim();
  const known = clients.find((client) => sameClientName(client.name, name));
  const due = dueOnOrNull(draft.dueOn);
  return {
    profile_id: profileId,
    title: draft.ask.replace(/\s+/g, " ").trim(),
    ...(known ? { client_id: known.id } : { new_client_name: name }),
    notes: notes.slice(0, BRIEF_READ_MAX) || null,
    work_item_ids: draft.workItemIds,
    ...(due ? { client_due_on: due } : {}),
  };
}

/** Ready to start: a client and an ask. The due date and documents are optional. */
export function draftReady(draft: BriefDraft): boolean {
  return draft.client.trim().length > 0 && draft.ask.trim().length > 0;
}

/** A due date as the card and the row say it: "Fri 27 Nov". */
export function dueLabel(date: string): string {
  const due = dueOnOrNull(date);
  if (!due) return "";
  const [y, m, d] = due.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** The build reveal's captions, in order. Each shows for at least STEP_MS while the reading arrives. */
export const PROPOSAL_REVEAL_STEP_MS = 1500;

export const PROPOSAL_CARD_COPY = {
  intro: (goal: number) =>
    `Starting a proposal. I'm pulling the client, the ask and the due date out of what you pasted. The ${goal} hour clock starts when you start it.`,
  reading: "Reading the brief you pasted",
  askStep: "Pulling out the ask",
  dueStep: "Setting the due date",
  checkStep: "Keeping only what the brief says",
  ready: (client: string) =>
    client ? `${client} proposal · check it, then start it` : "Check it, then start it",
  client: "Client",
  ask: "The ask",
  due: "Due",
  clock: "Clock",
  noneGiven: "None given",
  peopleLoading: "Reading the people we work with",
  clockLine: (goal: number) => `${goal} hours to get it out, from when you start it`,
  noClient: "The brief does not name the client. Type it in.",
  noAsk: "Say what they asked for.",
  noDue: "No due date in the brief. Add one if there is.",
  newClient: "A new client. Only an admin can add one.",
  docs: "Got documents for it? Drop them here and they go on the proposal.",
  drop: "Drop files here",
  choose: "Choose files",
  uploading: (n: number, total: number) => `Adding ${n} of ${total}`,
  remove: (name: string) => `Take ${name} off`,
  start: "Start the proposal",
  starting: "Starting",
  started: (client: string) => `${client} proposal · clock running`,
  next: "Next, someone has to own it. Pick the lead.",
  noPicking: "It is on Proposals. An admin or lead picks who leads it.",
  landed: (client: string) =>
    `${client} is on Proposals. We tucked the chat away so you can see it.`,
  openProposals: "Open Proposals",
  failed: "The proposal could not be started. Nothing was saved. Try again in a moment.",
  askInstead: "Ask the firm instead",
  docsFailed: (names: string) =>
    `${names} could not be added, so nothing was started. Take it off or try again.`,
  readFailed: "The brief could not be read just now. Nothing was saved.",
  tryAgain: "Try again",
} as const;

/** A Member's paste: passed to an admin, never started here. */
export const BRIEF_PASS_COPY = {
  line: (admin: string | null) =>
    admin
      ? `Admins and leads start proposals. I can tell ${admin} you have one, with what you just wrote.`
      : "Admins and leads start proposals. I can tell your admins you have one, with what you just wrote.",
  tell: (admin: string | null) => (admin ? `Tell ${admin}` : "Tell the admins"),
  telling: "Telling them",
  told: (admin: string | null) =>
    admin
      ? `Done. It is in ${admin}'s notifications.`
      : "Done. It is in your admins' notifications.",
  failed: "That did not reach an admin. Nothing was sent. Try again in a moment.",
  tooMany:
    "You have passed on several briefs today. Your admins will see them in their notifications.",
  noAdmin: "Your workspace has no admin to tell yet.",
  /** The bell, for the admin. */
  sentence: (by: string, client: string) =>
    client
      ? `${by} has a brief for a new proposal for ${client}.`
      : `${by} has a brief for a new proposal.`,
  open: "Open Proposals",
} as const;

/** The most briefs one person may pass on in a day, so the bell cannot be flooded. */
export const BRIEF_PASS_DAILY_MAX = 5;
/** What of the paste the admin sees in the bell: the start of it, the rest stays with the person. */
export const BRIEF_PASS_EXCERPT = 280;

export function passExcerpt(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > BRIEF_PASS_EXCERPT
    ? `${clean.slice(0, BRIEF_PASS_EXCERPT - 1).trimEnd()}…`
    : clean;
}

export type BriefPassResult = { ok: true; admins: number } | { ok: false; problem: string };
export type BriefAdmins = { name: string | null; count: number };
