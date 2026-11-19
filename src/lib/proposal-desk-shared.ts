/**
 * 20 Nov 2026, the Proposal Desk (Liam, D-34, D-37, D-38 and his go of 19 Nov): proposals as their own rows, before
 * any board exists. The pure rules: what a person may type, who sees which rows, the three dashboard views, and the
 * time left against the workspace's own turnaround goal.
 *
 * Nothing here rates, ranks or counts a person. A proposal has an owner, the person who started it, and that is all
 * a row says about anyone.
 */

/** The turnaround goal a workspace starts with, in hours, until an admin picks its own. */
export const DEFAULT_GOAL_HOURS = 72;
export const MIN_GOAL_HOURS = 1;
/** Thirty days. Longer than that is not a turnaround goal. */
export const MAX_GOAL_HOURS = 720;
/** The key in the workspace's settings that holds its goal. */
export const GOAL_SETTING_KEY = "proposal_goal_hours";

export const MAX_TITLE_CHARS = 160;
export const MAX_CLIENT_CHARS = 120;
export const MAX_NOTES_CHARS = 8000;
export const MAX_CONTEXT_ITEMS = 20;

export const PROPOSAL_STATUSES = ["open", "won", "lost"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const DESK_VIEWS = ["open", "mine", "won"] as const;
export type DeskView = (typeof DESK_VIEWS)[number];

export const DESK_COPY = {
  nav: "Proposals",
  title: "Proposals",
  subtitle: "Every open proposal, how long it has left, and what was won.",
  views: { open: "All open", mine: "Needs me", won: "Won" } as Record<DeskView, string>,
  empty: {
    open: "No open proposals. Start one when a brief comes in.",
    mine: "Nothing needs you.",
    won: "No proposal has been won yet.",
  } as Record<DeskView, string>,
  newProposal: "New proposal",
  tabs: { proposals: "Proposals", people: "People" },
  retry: "Try again",
  loading: "Loading proposals",
  loadFailed: "The proposals could not be loaded. Try again in a moment.",
  notHere: "Proposals are for company workspaces.",
  owner: (name: string) => `Started by ${name}`,
  yours: "Yours",
  context: (count: number) => (count === 0 ? "No documents yet" : count === 1 ? "1 document" : `${count} documents`),
  noBoardYet: "No board exists for an open proposal. The team board is made when it is won.",
  wonOn: (date: string) => `Won ${date}`,
  lostOn: (date: string) => `Lost ${date}`,
  openBoard: "Open the team board",
} as const;

export const INTAKE_COPY = {
  title: "New proposal",
  intro: "Drop in whatever you have. The team board is made when the proposal is won.",
  clientLegend: "Who is it for",
  existingClient: "Existing client",
  newClient: "New client",
  pickClient: "Choose a client",
  noClients: "No clients yet. Add this one as a new client.",
  clientName: "Client name",
  titleLabel: "What they asked for",
  titleHint: "A short name, such as Network redesign.",
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
  /** How many context documents wait on the proposal. Titles go only to the owner. */
  contextCount: number;
  contextTitles?: string[];
};

export type DeskList = {
  goalHours: number;
  /** May change the workspace's turnaround goal. */
  canSetGoal: boolean;
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
  | { state: "sent"; hoursTaken: number; withinGoal: boolean };

const HOUR_MS = 3_600_000;

/** Where a proposal stands against the goal. A date that cannot be read counts as "now", so nothing shows as late by years. */
export function timeLeft(input: { receivedAt: string; sentAt: string | null; goalHours: number; now?: Date | undefined }): TimeLeft {
  const now = (input.now ?? new Date()).getTime();
  const parsed = Date.parse(input.receivedAt);
  const received = Number.isFinite(parsed) ? Math.min(parsed, now) : now;
  if (input.sentAt) {
    const sent = Date.parse(input.sentAt);
    const taken = Math.max(0, Math.ceil(((Number.isFinite(sent) ? sent : now) - received) / HOUR_MS));
    return { state: "sent", hoursTaken: taken, withinGoal: taken <= input.goalHours };
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
  return left.withinGoal ? `Went out in ${hours(left.hoursTaken)}` : `Went out in ${hours(left.hoursTaken)}, over the ${goal} hour goal`;
}

/** The rows of one dashboard view, in the order a person reads them. */
export function deskView(proposals: readonly DeskProposal[], view: DeskView): DeskProposal[] {
  if (view === "won") {
    return proposals.filter((p) => p.status === "won").sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? "") || a.id.localeCompare(b.id));
  }
  // The proposals closest to their goal come first: the oldest brief still to go out.
  const urgency = (a: DeskProposal, b: DeskProposal) => Number(Boolean(a.sentAt)) - Number(Boolean(b.sentAt)) || a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id);
  const open = proposals.filter((p) => p.status === "open");
  return view === "mine" ? open.filter((p) => p.mine).sort(urgency) : open.sort(urgency);
}

export function deskCounts(proposals: readonly DeskProposal[]): Record<DeskView, number> {
  return { open: deskView(proposals, "open").length, mine: deskView(proposals, "mine").length, won: deskView(proposals, "won").length };
}

/** A date as the desk shows it: "Fri 20 Nov". */
export function deskDate(iso: string | null | undefined): string {
  const time = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(time)) return "";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(time));
}

/* ---------------------------------------------------------------------------
 * Inputs
 * ------------------------------------------------------------------------- */

export type DeskProfileInput = { profile_id: string | null };

export function deskProfileInput(input: { profile_id?: string | null | undefined } | undefined): DeskProfileInput {
  return { profile_id: uuidOrNull((input as Loose)?.["profile_id"]) };
}

export type IntakeProblem = keyof typeof INTAKE_COPY.problems;

export type NewProposalInput = DeskProfileInput & {
  title: string;
  /** Exactly one of these two is set. */
  client_id: string | null;
  new_client_name: string | null;
  notes: string | null;
  work_item_ids: string[];
};

export type NewProposalRaw = {
  profile_id?: string | null | undefined;
  title: string;
  client_id?: string | null | undefined;
  new_client_name?: string | null | undefined;
  notes?: string | null | undefined;
  work_item_ids?: string[] | undefined;
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
    input: { profile_id: uuidOrNull(loose?.["profile_id"]), title, client_id: clientId, new_client_name: clientId ? null : newName, notes: rawNotes || null, work_item_ids: ids },
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
