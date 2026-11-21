/**
 * 20 Nov 2026, the Proposal Desk (Liam, D-34, D-37, D-38 and his go of 19 Nov): proposals as their own rows, before
 * any board exists. The pure rules: what a person may type, who sees which rows, the three dashboard views, and the
 * time left against the workspace's own turnaround goal.
 *
 * Nothing here rates, ranks or counts a person. A proposal has an owner, the person who started it, and that is all
 * a row says about anyone.
 */

import { dueOnOrNull } from "./brief-read-shared";
import type { AskView, TextsState } from "./lead-ask-shared";

/** The turnaround goal a workspace starts with, in hours, until an admin picks its own. */
export const DEFAULT_GOAL_HOURS = 72;
export const MIN_GOAL_HOURS = 1;
/** Thirty days. Longer than that is not a turnaround goal. */
export const MAX_GOAL_HOURS = 720;
/** The key in the workspace's settings that holds its goal. */
export const GOAL_SETTING_KEY = "proposal_goal_hours";

/** The goals an admin picks from. Few and plain, so nobody types a number. */
export const GOAL_CHOICES: readonly number[] = [24, 48, 72, 96, 120, 168];

export function goalLabel(hours: number): string {
  if (hours % 24 !== 0 || hours < 48) return hours === 1 ? "1 hour" : `${hours} hours`;
  return `${hours} hours (${hours / 24} days)`;
}

/** The choices to offer: the fixed list, plus the saved goal when it is not one of them. */
export function goalChoices(current: number): number[] {
  return [...new Set([...GOAL_CHOICES, current])].sort((a, b) => a - b);
}

/** A goal an admin may save, or null. */
export function goalToSave(value: unknown): number | null {
  const hours = typeof value === "string" ? Number(value) : value;
  return typeof hours === "number" && Number.isInteger(hours) && hours >= MIN_GOAL_HOURS && hours <= MAX_GOAL_HOURS ? hours : null;
}

export const GOAL_COPY = {
  title: "Proposal turnaround goal",
  line: "How long your firm gives itself to get a proposal out after the brief comes in. Each open proposal shows the time left against it.",
  label: "Goal",
  save: "Save",
  saving: "Saving",
  saved: "Turnaround goal saved",
  failed: "The goal could not be saved. Nothing changed. Try again in a moment.",
  readOnly: (hours: number) => `Your firm's goal is ${goalLabel(hours)}. An admin can change it.`,
} as const;

export const SENT_COPY = {
  mark: "Mark as sent",
  /** Takes "sent" back. Says what the press does, so it cannot be read as the proposal's state. */
  undo: "Undo sent",
  working: "Saving",
  failed: "That could not be saved. Nothing changed. Try again in a moment.",
  notYours: "Only the person who started this proposal, an admin or a lead can change it.",
  closed: "This proposal is already decided.",
} as const;

/** 20 Nov: the lead on a proposal is a person from the roster. Admins and leads pick; nobody else sees the name. */
export const LEAD_COPY = {
  none: "No lead yet",
  lead: (name: string) => `Lead: ${name}`,
  pick: "Pick a lead",
  change: "Change",
  title: "Pick the lead",
  intro: "Choose who leads this proposal from People we work with. Picking a lead sends nothing.",
  select: "Choose a person",
  noPeople: "Nobody is on the list yet. Add people under the People tab first.",
  /** The list has not arrived: still loading, or it could not be read. One line, where the list would be. */
  noList: "The list of people is not here yet. If it stays empty, close this and try again.",
  agreed: (name: string) => `${name} has agreed to texts.`,
  notAgreed: (name: string) => `${name} has not agreed to texts. Copy their link under the People tab and send it to them.`,
  unknown: (name: string) => `We could not check whether ${name} agreed to texts.`,
  /** Where a text goes, said before anyone presses anything. */
  where: (demo: boolean) =>
    demo
      ? "This is a demo workspace: its texts go to the demo number, not to the person picked here."
      : "Texts go to the person picked here, and only once they have agreed to texts.",
  preview: "The won text, as it reads",
  save: "Save lead",
  saving: "Saving",
  clear: "No lead",
  cancel: "Cancel",
  notAllowed: "Only an admin or a lead can pick the lead.",
  closed: "This proposal is already decided.",
  missing: "That person is not on this workspace's list.",
  failed: "That could not be saved. Nothing changed. Try again in a moment.",
} as const;

export const WIN_COPY = {
  record: "Record the win",
  title: "Record the win",
  /** What pressing it does, said before it happens. */
  body: (documents: number) =>
    documents === 0
      ? "This makes the team board for this proposal. Your notes become its brief."
      : `This makes the team board for this proposal and puts your ${documents === 1 ? "context document" : `${documents} context documents`} on it first. Your notes become its brief.`,
  sharing: "People you add to the board will be able to open those documents. The board is not shared with the firm until you choose to.",
  confirm: "Make the team board",
  working: "Making the board",
  cancel: "Not yet",
  /** Shown to an admin or lead on someone else's proposal. */
  ownerOnly: (name: string) => `Only ${name || "the person who started it"} can record the win, because it puts their documents on the team board.`,
  notYours: "Only the person who started this proposal can record the win.",
  lost: "This proposal was recorded as lost.",
  failed: "The team board could not be made. Nothing changed. Try again in a moment.",
} as const;

export const MAX_TITLE_CHARS = 160;
export const MAX_CLIENT_CHARS = 120;
export const MAX_NOTES_CHARS = 8000;
export const MAX_CONTEXT_ITEMS = 20;

export const PROPOSAL_STATUSES = ["open", "won", "lost"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const DESK_VIEWS = ["open", "mine", "won", "lost"] as const;
export type DeskView = (typeof DESK_VIEWS)[number];

/** A view named in the address, other than the default one. Anything unknown is no view. */
export function deskViewFromSearch(value: unknown): Exclude<DeskView, "open"> | null {
  return value === "mine" || value === "won" || value === "lost" ? value : null;
}

/** 21 Nov (D-82): what an admin's Home may ask the Proposals page to open. Ids are checked for shape only. */
export type DeskLink = { proposal?: string; lead?: string; tab?: "people" };

export function deskLinkFromSearch(search: Record<string, unknown> | URLSearchParams): DeskLink {
  const read = (key: string): unknown => (search instanceof URLSearchParams ? search.get(key) : search[key]);
  const id = (value: unknown) => (typeof value === "string" && UUID.test(value) ? value.toLowerCase() : undefined);
  const proposal = id(read("proposal"));
  const lead = id(read("lead"));
  return { ...(proposal ? { proposal } : {}), ...(lead ? { lead } : {}), ...(read("tab") === "people" ? { tab: "people" as const } : {}) };
}

export const DESK_COPY = {
  nav: "Proposals",
  title: "Proposals",
  subtitle: "Every open proposal, how long it has left, and what was won.",
  views: { open: "All open", mine: "Needs me", won: "Won", lost: "Lost" } as Record<DeskView, string>,
  empty: {
    open: "No open proposals. Start one when a brief comes in.",
    mine: "Nothing needs you.",
    won: "No proposal has been won yet.",
    lost: "No proposal has been closed as lost.",
  } as Record<DeskView, string>,
  newProposal: "New proposal",
  tabs: { proposals: "Proposals", people: "People" },
  retry: "Try again",
  loading: "Loading proposals",
  loadFailed: "The proposals could not be loaded. Try again in a moment.",
  /** QA M1 (21 Nov): the proposal saved but the list could not be read again, so its row is not shown yet. */
  startedNotRefreshed: "Proposal started. The list could not be refreshed; try again in a moment.",
  notHere: "Proposals are for the members of a company workspace.",
  notHereCoach: "Proposals are for the firm's own team. As a coach you do not see them.",
  owner: (name: string) => `Started by ${name}`,
  due: (day: string) => `Due ${day}`,
  yours: "Yours",
  context: (count: number) => (count === 0 ? "No documents yet" : count === 1 ? "1 document" : `${count} documents`),
  noBoardYet: "No board exists for an open proposal. The team board is made when it is won.",
  wonOn: (date: string) => `Won ${date}`,
  lostOn: (date: string) => `Lost ${date}`,
  openBoard: "Open the team board",
} as const;

/** 20 Nov: closing an open proposal as lost, and archiving one made by mistake. */
export const CLOSE_COPY = {
  lost: "Close as lost",
  archive: "Archive",
  lostTitle: "Close as lost",
  lostBody: "This closes the proposal as lost. It moves to the Lost view and no team board is made. It cannot be reopened from here.",
  archiveTitle: "Archive this proposal",
  archiveBody: "Use this for a proposal made by mistake. It leaves the Proposals page for everyone. Its documents stay in their owner's work. Nothing is deleted.",
  confirmLost: "Close as lost",
  confirmArchive: "Archive",
  working: "Saving",
  cancel: "Not now",
  notYours: "Only the person who started this proposal, an admin or a lead can close it.",
  adminOnly: "Only an admin can archive a proposal.",
  won: "A won proposal has a team board, so it cannot be closed or archived here.",
  decided: "This proposal is already decided.",
  failed: "That could not be saved. Nothing changed. Try again in a moment.",
} as const;

export const INTAKE_COPY = {
  title: "New proposal",
  intro: "Drop in whatever you have. The team board is made when the proposal is won.",
  /** Shown on the form while a proposal just started is not in the list yet, so a second one is never made by accident. */
  justStarted: (title: string) => (title ? `You just started "${title}". It is saved, so there is no need to start it again.` : "You just started a proposal. It is saved, so there is no need to start it again."),
  clientLegend: "Who is it for",
  existingClient: "Existing client",
  newClient: "New client",
  pickClient: "Choose a client",
  noClients: "No clients yet. Add this one as a new client.",
  /** Shown before anything is uploaded, to someone who may not add a client. */
  adminAddsClients: "An admin adds new clients. Choose an existing client, or ask an admin to add this one first.",
  noClientsForMember: "There are no clients yet, and only an admin can add one. Ask an admin to add this client first.",
  clientsOffForAdmin: "Clients are switched off for this workspace. Turn on Use clients in Settings, then add this one here.",
  clientName: "Client name",
  titleLabel: "What they asked for",
  titleHint: "A short name, such as Network redesign.",
  /** 20 Nov 2026, PR 3b: the client's due date. */
  dueLabel: "Due",
  dueHint: "When the client wants it, if they said. Leave it empty if not.",
  documents: "Context documents",
  documentsHint: "Call notes, emails, anything the client sent. They stay yours until the proposal is won.",
  addFiles: "Add documents",
  uploading: (done: number, total: number) => `Adding ${done} of ${total}`,
  remove: (name: string) => `Remove ${name}`,
  notes: "Notes",
  notesHint: "Anything not written down elsewhere.",
  create: "Start proposal",
  creating: "Starting",
  cancel: "Cancel",
  problems: {
    title: "Give the proposal a short name.",
    titleLong: `Keep the name under ${MAX_TITLE_CHARS} characters.`,
    client: "Choose a client, or add a new one.",
    clientName: "Type the new client's name.",
    clientLong: `Keep the client's name under ${MAX_CLIENT_CHARS} characters.`,
    notesLong: `Keep the notes under ${MAX_NOTES_CHARS} characters.`,
    tooMany: `Add up to ${MAX_CONTEXT_ITEMS} documents.`,
    notYours: "One of those documents is not yours to add.",
    clientGone: "That client is not in this workspace any more. Choose another.",
    adminAddsClients: "Only an admin can add a new client. Choose an existing client, or ask an admin to add this one first.",
    failed: "The proposal could not be started. Nothing was saved. Try again in a moment.",
    upload: (name: string, reason: string) => `${name} could not be added: ${reason}`,
  },
} as const;

/** A proposal as the dashboard draws it. Never more about a person than the owner's name. */
export type DeskProposal = {
  id: string;
  title: string;
  clientName: string;
  ownerName: string;
  mine: boolean;
  status: ProposalStatus;
  receivedAt: string;
  sentAt: string | null;
  decidedAt: string | null;
  /** The team board, once the win has made it. */
  engagementId: string | null;
  /** 20 Nov 2026, PR 3a: the client's due date, YYYY-MM-DD, when the brief or the form gave one. */
  dueOn?: string | null;
  /** How many context documents wait on the proposal. Titles go only to the owner. */
  contextCount: number;
  contextTitles?: string[];
  /** May mark it sent: the person who started it, an admin or a lead. Recording the win is for `mine` only. */
  canAct: boolean;
  /** The picked lead's roster id. Sent only to admins and leads, who are the only people who see the roster. */
  leadContactId?: string | null;
  /** The picked lead's name. Sent to admins, leads and the person who started the proposal. */
  leadName?: string | null;
  /** The latest ask sent to the lead, and its answer. Sent to the same people as the lead's name. */
  ask?: AskView | null;
  /** May close it as lost: the person who started it, an admin or a lead, while it is open. */
  canClose: boolean;
  /** May archive it as made by mistake: an admin, while it is not won. */
  canArchive: boolean;
};

export type DeskList = {
  goalHours: number;
  /** May change the workspace's turnaround goal. */
  canSetGoal: boolean;
  /** May pick a proposal's lead from the roster: an admin or a lead. */
  canPickLead: boolean;
  /** May add a new client while starting a proposal: an admin, in a workspace with clients switched on. */
  canAddClient: boolean;
  /** An admin whose workspace has clients switched off: told where to switch them on, not to ask an admin. */
  clientsOff?: boolean | undefined;
  /** Where this workspace's texts go, and whether texting is switched on. */
  texts: TextsState;
  proposals: DeskProposal[];
};


export type DeskClient = { id: string; name: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Loose = Record<string, unknown> | null | undefined;
const text = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
const uuidOrNull = (value: unknown): string | null => (typeof value === "string" && UUID.test(value.trim()) ? value.trim() : null);

/** The workspace's goal in whole hours. Anything missing or out of range reads as the default, never as zero. */
export function goalHours(settings: unknown): number {
  const raw = settings && typeof settings === "object" ? (settings as Record<string, unknown>)[GOAL_SETTING_KEY] : undefined;
  return typeof raw === "number" && Number.isInteger(raw) && raw >= MIN_GOAL_HOURS && raw <= MAX_GOAL_HOURS ? raw : DEFAULT_GOAL_HOURS;
}

/** Roles that see every proposal in the workspace and may change its goal. */
export function seesAllProposals(role: string | null | undefined): boolean {
  return role === "admin" || role === "lead";
}

export type TimeLeft =
  /** Still to go out, inside the goal. */
  | { state: "running"; hoursLeft: number }
  /** Still to go out, past the goal. */
  | { state: "over"; hoursOver: number }
  /** Gone out. */
  | { state: "sent"; hoursTaken: number; withinGoal: boolean; underAnHour?: boolean | undefined };

const HOUR_MS = 3_600_000;

/** Where a proposal stands against the goal. A date that cannot be read counts as "now", so nothing shows as late by years. */
export function timeLeft(input: { receivedAt: string; sentAt: string | null; goalHours: number; now?: Date | undefined }): TimeLeft {
  const now = (input.now ?? new Date()).getTime();
  const parsed = Date.parse(input.receivedAt);
  const received = Number.isFinite(parsed) ? Math.min(parsed, now) : now;
  if (input.sentAt) {
    const sent = Date.parse(input.sentAt);
    const tookMs = Math.max(0, (Number.isFinite(sent) ? sent : now) - received);
    const taken = Math.ceil(tookMs / HOUR_MS);
    return { state: "sent", hoursTaken: taken, withinGoal: taken <= input.goalHours, ...(tookMs < HOUR_MS ? { underAnHour: true } : {}) };
  }
  const elapsedMs = now - received;
  const goalMs = input.goalHours * HOUR_MS;
  if (elapsedMs <= goalMs) return { state: "running", hoursLeft: Math.max(0, Math.floor((goalMs - elapsedMs) / HOUR_MS)) };
  return { state: "over", hoursOver: Math.max(1, Math.ceil((elapsedMs - goalMs) / HOUR_MS)) };
}

const hours = (count: number) => (count === 1 ? "1 hour" : `${count} hours`);

/** The one line a person reads for the clock. */
export function timeLeftLine(left: TimeLeft, goal: number): string {
  if (left.state === "running") return left.hoursLeft < 1 ? `Less than an hour left of ${goal}` : `${hours(left.hoursLeft)} left of ${goal}`;
  if (left.state === "over") return `Over the ${goal} hour goal by ${hours(left.hoursOver)}`;
  // Minutes after the brief is not "1 hour".
  const took = left.underAnHour ? "under an hour" : hours(left.hoursTaken);
  return left.withinGoal ? `Went out in ${took}` : `Went out in ${took}, over the ${goal} hour goal`;
}

/** The rows of one dashboard view, in the order a person reads them. */
export function deskView(proposals: readonly DeskProposal[], view: DeskView): DeskProposal[] {
  if (view === "won" || view === "lost") {
    return proposals.filter((p) => p.status === view).sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? "") || a.id.localeCompare(b.id));
  }
  // The proposals closest to their goal come first: the oldest brief still to go out.
  const urgency = (a: DeskProposal, b: DeskProposal) => Number(Boolean(a.sentAt)) - Number(Boolean(b.sentAt)) || a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id);
  const open = proposals.filter((p) => p.status === "open");
  return view === "mine" ? open.filter((p) => p.mine).sort(urgency) : open.sort(urgency);
}

export function deskCounts(proposals: readonly DeskProposal[]): Record<DeskView, number> {
  return { open: deskView(proposals, "open").length, mine: deskView(proposals, "mine").length, won: deskView(proposals, "won").length, lost: deskView(proposals, "lost").length };
}

/**
 * A date as the desk shows it: "Fri 20 Nov". A date in another year says which ("Mon 4 Aug 2025"), so a list that
 * runs across years still reads in order.
 */
export function deskDate(iso: string | null | undefined, now: Date = new Date()): string {
  const time = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(time)) return "";
  const date = new Date(time);
  // This year's dates read exactly as before; another year's has the year after it.
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  return date.getUTCFullYear() === now.getUTCFullYear() ? day : `${day} ${date.getUTCFullYear()}`;
}

/* ---------------------------------------------------------------------------
 * Inputs
 * ------------------------------------------------------------------------- */

export type DeskProfileInput = { profile_id: string | null };

export function deskProfileInput(input: { profile_id?: string | null | undefined } | undefined): DeskProfileInput {
  return { profile_id: uuidOrNull((input as Loose)?.["profile_id"]) };
}

export type SentInput = DeskProfileInput & { proposal_id: string; sent: boolean };

export function sentInput(raw: { profile_id?: string | null | undefined; proposal_id: string; sent: boolean }): SentInput {
  const loose = raw as Loose;
  const id = uuidOrNull(loose?.["proposal_id"]);
  if (!id) throw new Error(SENT_COPY.failed);
  return { profile_id: uuidOrNull(loose?.["profile_id"]), proposal_id: id, sent: loose?.["sent"] === true };
}

export type SentResult = { ok: true } | { ok: false; problem: string };

export type LeadInput = DeskProfileInput & { proposal_id: string; lead_contact_id: string | null };

/** A lead pick. A null contact clears the lead; a contact that is not an id is refused rather than read as "clear". */
export function leadInput(raw: { profile_id?: string | null | undefined; proposal_id: string; lead_contact_id: string | null }): LeadInput {
  const loose = raw as Loose;
  const id = uuidOrNull(loose?.["proposal_id"]);
  const contact = loose?.["lead_contact_id"];
  const contactId = contact === null ? null : uuidOrNull(contact);
  if (!id || (contact !== null && !contactId)) throw new Error(LEAD_COPY.failed);
  return { profile_id: uuidOrNull(loose?.["profile_id"]), proposal_id: id, lead_contact_id: contactId };
}

export type LeadResult = { ok: true } | { ok: false; problem: string };

export type WinInput = DeskProfileInput & { proposal_id: string };

export function winInput(raw: { profile_id?: string | null | undefined; proposal_id: string }): WinInput {
  const loose = raw as Loose;
  const id = uuidOrNull(loose?.["proposal_id"]);
  if (!id) throw new Error(WIN_COPY.failed);
  return { profile_id: uuidOrNull(loose?.["profile_id"]), proposal_id: id };
}

export type CloseInput = DeskProfileInput & { proposal_id: string; change: "lost" | "archived" };

export function closeInput(raw: { profile_id?: string | null | undefined; proposal_id: string; change: string }): CloseInput {
  const loose = raw as Loose;
  const id = uuidOrNull(loose?.["proposal_id"]);
  const change = loose?.["change"];
  if (!id || (change !== "lost" && change !== "archived")) throw new Error(CLOSE_COPY.failed);
  return { profile_id: uuidOrNull(loose?.["profile_id"]), proposal_id: id, change };
}

export type CloseResult = { ok: true } | { ok: false; problem: string };

export type GoalInput = DeskProfileInput & { hours: number };

export function goalInput(raw: { profile_id?: string | null | undefined; hours: number }): GoalInput {
  const loose = raw as Loose;
  const hours = goalToSave(loose?.["hours"]);
  if (hours === null) throw new Error(GOAL_COPY.failed);
  return { profile_id: uuidOrNull(loose?.["profile_id"]), hours };
}

export type GoalResult = { ok: true } | { ok: false; problem: string };

/** 20 Nov: a board made by a win, as the strip at its top reads. Never more about a person than the lead's name and their one-word answer. */
export type BoardWin =
  | { won: false }
  | { won: true; decidedAt: string | null; leadName: string | null; ask: AskView | null };

export const BOARD_WIN_COPY = {
  won: (date: string) => (date ? `Proposal won ${date}` : "Proposal won"),
  lead: (name: string) => `Lead: ${name}`,
} as const;

export type BoardInput = DeskProfileInput & { engagement_id: string };

export function boardInput(raw: { profile_id?: string | null | undefined; engagement_id: string }): BoardInput {
  const loose = raw as Loose;
  const id = uuidOrNull(loose?.["engagement_id"]);
  if (!id) throw new Error("Unknown board.");
  return { profile_id: uuidOrNull(loose?.["profile_id"]), engagement_id: id };
}

export type WinResult = { ok: true; engagementId: string } | { ok: false; problem: string };

export type IntakeProblem = keyof typeof INTAKE_COPY.problems;

export type NewProposalInput = DeskProfileInput & {
  title: string;
  /** Exactly one of these two is set. */
  client_id: string | null;
  new_client_name: string | null;
  notes: string | null;
  work_item_ids: string[];
  /** 20 Nov 2026, chat pill PR 3a: the client's due date, YYYY-MM-DD, when the brief says one. */
  client_due_on?: string | null | undefined;
};

export type NewProposalRaw = {
  profile_id?: string | null | undefined;
  title: string;
  client_id?: string | null | undefined;
  new_client_name?: string | null | undefined;
  notes?: string | null | undefined;
  work_item_ids?: string[] | undefined;
  client_due_on?: string | null | undefined;
};

/** What the form and the server both check, so the two can never disagree. */
export function checkNewProposal(raw: NewProposalRaw): { ok: true; input: NewProposalInput } | { ok: false; problem: Exclude<IntakeProblem, "upload"> } {
  const loose = raw as Loose;
  const title = text(loose?.["title"]);
  if (!title) return { ok: false, problem: "title" };
  if (title.length > MAX_TITLE_CHARS) return { ok: false, problem: "titleLong" };
  const clientId = uuidOrNull(loose?.["client_id"]);
  const newName = text(loose?.["new_client_name"]);
  if (clientId && newName) return { ok: false, problem: "client" };
  if (!clientId && !newName) return { ok: false, problem: typeof loose?.["new_client_name"] === "string" ? "clientName" : "client" };
  if (newName.length > MAX_CLIENT_CHARS) return { ok: false, problem: "clientLong" };
  const rawNotes = typeof loose?.["notes"] === "string" ? (loose["notes"] as string).trim() : "";
  if (rawNotes.length > MAX_NOTES_CHARS) return { ok: false, problem: "notesLong" };
  const list = Array.isArray(loose?.["work_item_ids"]) ? (loose["work_item_ids"] as unknown[]) : [];
  const valid = list.map(uuidOrNull).filter((id): id is string => id !== null);
  // Anything that is not an id is refused; the same document twice is just that document.
  if (valid.length !== list.length) return { ok: false, problem: "notYours" };
  const ids = [...new Set(valid)];
  if (ids.length > MAX_CONTEXT_ITEMS) return { ok: false, problem: "tooMany" };
  return {
    ok: true,
    input: {
      profile_id: uuidOrNull(loose?.["profile_id"]),
      title,
      client_id: clientId,
      new_client_name: clientId ? null : newName,
      notes: rawNotes || null,
      work_item_ids: ids,
      // Anything that is not a real date is no date: a due date is never invented or guessed.
      ...(dueOnOrNull(loose?.["client_due_on"]) ? { client_due_on: dueOnOrNull(loose?.["client_due_on"]) } : {}),
    },
  };
}

/** The server function's validator: the same check, thrown. */
export function newProposalInput(raw: NewProposalRaw): NewProposalInput {
  const checked = checkNewProposal(raw);
  if (!checked.ok) throw new Error(INTAKE_COPY.problems[checked.problem]);
  return checked.input;
}

export type NewProposalResult = { ok: true; id: string } | { ok: false; problem: string };

/** Two client names are the same client when they match ignoring case and spacing. */
export function sameClientName(a: string, b: string): boolean {
  return text(a).toLocaleLowerCase() === text(b).toLocaleLowerCase();
}

/** A count as an event may carry it: a band, never the number. */
export function countBand(count: number): "0" | "1" | "2-5" | "6+" {
  if (count <= 0) return "0";
  if (count === 1) return "1";
  return count <= 5 ? "2-5" : "6+";
}

/**
 * 20 Nov 2026 (Liam, D-86: "the mix it starts on"). The Proposals space: one proposal is Up next, with the page's
 * one filled button; the rare changes sit under More. Nothing here rates or ranks a person: Up next is the proposal
 * closest to its goal that this person can move, in the same reading order the list already uses.
 */
export const SPACE_COPY = {
  upNext: "Up next",
  more: "More",
  moreLabel: (client: string, title: string) => `More for ${client ? `${client}: ` : ""}${title}`,
  /** The lead as a chip: who, and the state of the ask in a word or two. */
  leadLabel: "Lead:",
  /** The ask on the chip in a word or two. The full sentence stays on the line beneath it. */
  ask: { asked: "Asked", yes: "Yes", no: "No", stopped: "Opted out", notSent: "Not sent", notArrived: "Not arrived", noReply: "No reply", practice: "Practice" },
} as const;

const NOT_ARRIVED_STATUSES = ["undelivered", "failed", "expired"] as const;
export type AskWord = keyof typeof SPACE_COPY.ask;

/** The ask in a word, for the lead's chip, in the same order of precedence as the line beneath it. */
export function askWord(ask: AskView | null | undefined): AskWord | null {
  if (!ask) return null;
  // QA M1: a practice answer is never a real yes or no. The chip keeps the practice look; the line says the answer.
  if (ask.practice) return "practice";
  if (ask.reply === "yes") return "yes";
  if (ask.reply === "no") return "no";
  if (ask.reply === "stop" || ask.status === "opted_out") return "stopped";
  // QA M2: a refused text was never sent, so the chip says so rather than that it got lost.
  if (ask.status === "rejected") return "notSent";
  if ((NOT_ARRIVED_STATUSES as readonly string[]).includes(ask.status)) return "notArrived";
  if (!ask.waiting) return "noReply";
  return "asked";
}

export type NextStep = "send" | "win";

/** The next step this person can take on a proposal: getting it out first, then recording the win. */
export function nextStep(proposal: DeskProposal, can: { send: boolean; win: boolean }): NextStep | null {
  if (proposal.status !== "open") return null;
  if (can.send && proposal.canAct && !proposal.sentAt) return "send";
  if (can.win && proposal.mine) return "win";
  return null;
}

/**
 * The proposal that is Up next: the first row, in the order the person reads the list, that has a step they can take.
 * None when nothing can be moved here (Home, which is read only, or a view of decided proposals).
 */
export function upNextId(rows: readonly DeskProposal[], can: { send: boolean; win: boolean }): string | null {
  return rows.find((row) => nextStep(row, can) !== null)?.id ?? null;
}

/**
 * 20 Nov 2026 (Liam: "the board reveal ... should look more like the figjam boards that are really created"). While
 * Record the win makes the board, the dialog draws that board building in: the brief from the notes, the documents as
 * small pictures, the lead. Each caption names what the server is really doing, in the order it does it.
 */
export const REVEAL_COPY = {
  stages: (client: string, documents: number, lead: string) =>
    [
      `Making the team board${client ? ` for ${client}` : ""}`,
      "Turning your notes into its brief",
      ...(documents > 0 ? [documents === 1 ? "Putting your context document on it" : `Putting your ${documents} context documents on it`] : []),
      ...(lead ? [`Naming ${lead} as the lead`] : []),
      "Opening the board",
    ] as string[],
  brief: "The brief",
  briefLine: "From your notes",
  /** A document whose title this person is not sent. */
  document: "Context document",
  board: "Team board",
  label: "The team board, being made",
  /** Each stage stays readable: about 1.4 seconds apiece. */
  stageMs: 1400,
} as const;

/**
 * D-86 (Liam: "No past work with us yet" beside a person with none). The work each person on the roster has led with
 * this firm: the won proposals that name them as lead, newest first. Read from the list the page already has, so it
 * adds no request. Only the client and the title: never a count, a fee, a value or how fast anyone answered.
 */
export function pastWorkByLead(proposals: readonly DeskProposal[]): Record<string, { client: string; title: string }[]> {
  const out: Record<string, { client: string; title: string }[]> = {};
  const won = proposals
    .filter((proposal) => proposal.status === "won" && proposal.leadContactId)
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? "") || a.id.localeCompare(b.id));
  for (const proposal of won) {
    const id = proposal.leadContactId as string;
    (out[id] ??= []).push({ client: proposal.clientName, title: proposal.title });
  }
  return out;
}

/**
 * After New proposal saves, what the page does next. The list has just been read again: when the new proposal is in
 * it, someone who may pick a lead goes straight to the lead sheet and everyone else to the rows. When it is not (the
 * read failed, or has not caught up), the page says the proposal was started and opens nothing by itself later.
 */
export function afterCreate(list: DeskList | undefined, id: string, mayPickLead: boolean): "sheet" | "rows" | "notRefreshed" {
  const shown = list?.proposals.some((proposal) => proposal.id === id && proposal.status === "open") ?? false;
  if (!shown) return "notRefreshed";
  return mayPickLead ? "sheet" : "rows";
}
