/**
 * 20 Nov 2026, the Proposal Desk: the handlers behind the Proposals page. A proposal is a row of its own; no board
 * exists until the win (Liam, D-37).
 *
 * Reads run as the signed-in person, so the database's row rules decide what comes back, and the code filters again
 * (own workspace; own proposals unless admin or lead). Writes go through the service role after the checks here,
 * because neither table has a write policy. Every rule takes its outside world as `DeskStore`, so each is tested
 * without a database.
 *
 * Privacy: a context document's title goes only to the proposal's owner; everyone else gets a count. Events carry
 * bands and yes or no, never a title, a client's name, a note or a person.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { isPracticeAsk, isRecordedAnswer, isWaiting, type AskView, type TextsState, type TextStatus, type Reply } from "./lead-ask-shared";
import {
  CLOSE_COPY,
  GOAL_COPY,
  GOAL_SETTING_KEY,
  type BoardInput,
  type BoardWin,
  type CloseInput,
  type CloseResult,
  type GoalInput,
  type GoalResult,
  countBand,
  goalHours,
  pastWorkByLead,
  INTAKE_COPY,
  LEAD_COPY,
  SENT_COPY,
  timeLeft,
  WIN_COPY,
  PROPOSAL_STATUSES,
  sameClientName,
  seesAllProposals,
  type DeskClient,
  type DeskList,
  type DeskProfileInput,
  type DeskProposal,
  type NewProposalInput,
  type NewProposalResult,
  type ProposalStatus,
  type SentInput,
  type SentResult,
  type WinInput,
  type WinResult,
  type LeadInput,
  type LeadResult,
} from "./proposal-desk-shared";
import { canManageRoster } from "./roster-shared";
import { sendState, type SentDocs } from "./lead-view-shared";
import { approvalForReader, type ApprovalView } from "./proposal-approval-shared";

type Db = SupabaseClient<Database>;
/** The two new tables are not in the generated types until the migration is applied and the types are regenerated. */
type LooseDb = SupabaseClient;

export type DeskCaller = { profileId: string; orgId: string; role: string; userId: string };

export type ProposalRow = {
  id: string;
  org_id: string;
  client_id: string;
  title: string;
  owner_id: string;
  received_at: string;
  sent_at: string | null;
  status: string;
  decided_at: string | null;
  engagement_id: string | null;
  lead_contact_id?: string | null;
  archived_at?: string | null;
  /** 20 Nov 2026, PR 3a: arrives with the client_due_on migration. */
  client_due_on?: string | null;
};

/** The latest ask on a proposal, as stored. */
export type DeskAsk = { proposal_id: string; contact_id: string | null; to_demo: boolean; status: string; reply: string | null; created_at: string; status_at?: string | null; replied_at?: string | null; sent_by?: string | null };

export type DeskStore = {
  /** An active, non-guest member of a company workspace, or a thrown 403. */
  caller: () => Promise<DeskCaller>;
  settings: (orgId: string) => Promise<unknown>;
  /** The proposals the database lets this person read. Null when the read failed. */
  proposals: (orgId: string) => Promise<ProposalRow[] | null>;
  clientNames: (ids: string[]) => Promise<Map<string, string>>;
  ownerNames: (ids: string[]) => Promise<Map<string, string>>;
  /** Which work items sit on which proposals, in order. */
  context: (proposalIds: string[]) => Promise<{ proposal_id: string; work_item_id: string }[]>;
  itemTitles: (ids: string[]) => Promise<Map<string, string>>;
  /** Clients (never folders, never archived) of the workspace. */
  clients: (orgId: string) => Promise<DeskClient[]>;
  /** Adds a client the way the app already does, as the signed-in person. Null when refused. */
  createClient: (orgId: string, name: string) => Promise<string | null>;
  removeClient: (id: string) => Promise<void>;
  /** Of these work items, the ones in this workspace that belong to this person. */
  ownedItems: (orgId: string, profileId: string, ids: string[]) => Promise<string[]>;
  insertProposal: (row: { id: string; org_id: string; client_id: string; title: string; notes: string | null; owner_id: string; client_due_on?: string }) => Promise<boolean>;
  insertContext: (rows: { proposal_id: string; work_item_id: string; position: number }[]) => Promise<boolean>;
  removeProposal: (id: string) => Promise<void>;
  /** One proposal, read by the server. Null when it does not exist. */
  proposal: (id: string) => Promise<ProposalRow | null>;
  /** Sets or clears when the proposal went out. False when nothing changed. */
  setSent: (id: string, sentAt: string | null) => Promise<boolean>;
  /** Whether this roster person is on this workspace's list. */
  rosterHas: (orgId: string, contactId: string) => Promise<boolean>;
  /** Sets or clears the lead on an open proposal. False when nothing changed. */
  setLead: (id: string, contactId: string | null) => Promise<boolean>;
  /** The salesperson's notes on one proposal. */
  notes: (id: string) => Promise<string | null>;
  /** Makes the board, owned by this person and with them on it. Not shared with the firm. False when refused. */
  makeBoard: (board: { id: string; orgId: string; title: string; clientId: string; brief: string | null; ownerId: string }) => Promise<boolean>;
  /** The board's home for loose work, asked for as the signed-in person. Null when refused. */
  boardHome: (engagementId: string) => Promise<string | null>;
  /** Puts these work items on the board in this order, as the signed-in person, so the database's own rule decides. */
  placeItems: (taskId: string, itemIds: string[], at: Date) => Promise<boolean>;
  /** The board's proposal history: when the brief came in, when it went out, when it was won. */
  writeLedger: (rows: { org_id: string; engagement_id: string; kind: "brief_received" | "sent_to_client" | "won"; occurred_at: string }[]) => Promise<boolean>;
  /** Marks the proposal won and ties it to its board, only if it is still open. False when it was not open any more. */
  claimWin: (id: string, engagementId: string, decidedAt: string) => Promise<boolean>;
  /** Takes back a board this code just made and could not finish. */
  removeBoard: (id: string) => Promise<void>;
  record: (caller: DeskCaller, eventType: "proposal.created" | "proposal.sent" | "proposal.won" | "proposal.lead_set" | "proposal.closed", dims: Record<string, string>) => Promise<void>;
  /** Names of these roster people, only those on this workspace's list. */
  leadNames: (orgId: string, contactIds: string[]) => Promise<Map<string, string>>;
  /** 21 Nov 2026, PR 4b: of these roster people, the ones linked to a teammate's login. Left out, none are. */
  leadLinks?: (orgId: string, contactIds: string[]) => Promise<Set<string>>;
  /** 21 Nov 2026, PR 4b: what each of these proposals' owners sent to the lead. Left out, nothing was sent. */
  leadDocsSent?: (orgId: string, proposalIds: string[]) => Promise<Map<string, SentDocs>>;
  /** 21 Nov 2026, Phase 5: the latest approval request per proposal. Left out, none. */
  approvals?: (orgId: string, proposalIds: string[]) => Promise<Map<string, ApprovalView>>;
  /** The asks sent about these proposals in this workspace, newest first. Empty when there are none or they cannot be read. */
  asks: (orgId: string, proposalIds: string[]) => Promise<DeskAsk[]>;
  /** Where this workspace's texts go, and whether texting is switched on. */
  texts: (orgId: string) => Promise<TextsState>;
  /** Whether this workspace has clients switched on, which adding one needs. */
  clientsOn: (orgId: string) => Promise<boolean>;
  /** Closes an open proposal as lost. False when it was not open any more. */
  closeLost: (id: string, decidedAt: string) => Promise<boolean>;
  /** Archives a proposal that is not won. False when nothing changed. */
  archive: (id: string, at: string) => Promise<boolean>;
  /**
   * 21 Nov (after PR 303): closes any approval request still waiting on a proposal that was just archived, lost or won,
   * as withdrawn by the system (no person named). The request row is decided, never deleted, so the history stays.
   */
  closeApprovals?: (id: string, at: string) => Promise<void>;
  /** Saves one workspace setting, touching no other. False when refused. */
  saveSetting: (orgId: string, key: string, value: number) => Promise<boolean>;
  /** The board, only if the signed-in person can open it. */
  board: (engagementId: string) => Promise<{ orgId: string } | null>;
  /** The proposal a board was made from, in this workspace. */
  boardProposal: (orgId: string, engagementId: string) => Promise<ProposalRow | null>;
  now: () => Date;
  newId: () => string;
};

const isStatus = (value: string): value is ProposalStatus => (PROPOSAL_STATUSES as readonly string[]).includes(value);

/**
 * QA H1 and N1 on PR 285: whether the ask's latest change (reply, else delivery report, else sending) came within the
 * last day, by a window the server alone sets: from the top of the hour 24 hours ago until now. Nothing from the
 * browser moves its edges, so no read can be shaped to narrow a reply down, and because the window's start only moves
 * on the hour, the flag dropping off later says no more than the hour of the reply. A rolling window follows every
 * time zone alike, so a morning yes does not drop off at UTC midnight.
 */
export function changedInLastDay(ask: Pick<DeskAsk, "replied_at" | "status_at" | "created_at">, now: Date): boolean {
  const at = Date.parse(ask.replied_at ?? ask.status_at ?? ask.created_at);
  const start = Math.floor(now.getTime() / 3_600_000) * 3_600_000 - 86_400_000;
  return Number.isFinite(at) && at >= start && at <= now.getTime();
}

/** The latest ask per proposal, as the page draws it. */
function askViews(asks: DeskAsk[], names: Map<string, string>, now: Date, flagRecent = false, recorders: Map<string, string> = new Map()): Map<string, AskView> {
  const views = new Map<string, AskView>();
  for (const ask of asks) {
    if (views.has(ask.proposal_id)) continue;
    views.set(ask.proposal_id, {
      name: ask.contact_id ? (names.get(ask.contact_id) ?? "") : "",
      status: ask.status as TextStatus,
      reply: (ask.reply as Reply | null) ?? null,
      practice: isPracticeAsk(ask),
      recorded: isRecordedAnswer(ask),
      // QA L1 of PR 287: who recorded an answer heard another way, by name.
      ...(isRecordedAnswer(ask) && ask.sent_by && recorders.get(ask.sent_by) ? { recordedBy: recorders.get(ask.sent_by) } : {}),
      // QA M1 of PR 287: the latest ask on a proposal waits for its answer, practice or not. A practice ask is never
      // stranded when the sender's pause lifts; a real ask made after it simply becomes the latest.
      waiting: isWaiting({ status: ask.status, reply: ask.reply, createdAt: ask.created_at }, now),
      ...(flagRecent && changedInLastDay(ask, now) ? { recent: true as const } : {}),
    });
  }
  return views;
}

/** Who may add a new client while starting a proposal: an admin, where clients are switched on. The database's own rule. */
async function mayAddClient(store: DeskStore, caller: DeskCaller): Promise<boolean> {
  return caller.role === "admin" && (await store.clientsOn(caller.orgId));
}

/** The dashboard's rows. */
export async function listDesk(store: DeskStore): Promise<DeskList> {
  const caller = await store.caller();
  const all = seesAllProposals(caller.role);
  // The roster is for admins and leads, so only they are told who the lead is.
  const pickers = canManageRoster(caller.role);
  const rows = await store.proposals(caller.orgId);
  if (rows === null) throw new Error("proposals_unreadable");
  // The database already decided; this is the same rule again, so a policy mistake cannot widen what is shown.
  const mine = rows.filter((row) => row.org_id === caller.orgId && isStatus(row.status) && !row.archived_at && (all || row.owner_id === caller.profileId));
  // The lead's name and the ask go to admins, leads and the person who started the proposal.
  const named = mine.filter((row) => pickers || row.owner_id === caller.profileId);
  const [settings, clientNames, ownerNames, context, leadNames, asks, texts, clientsOn] = await Promise.all([
    store.settings(caller.orgId),
    store.clientNames([...new Set(mine.map((row) => row.client_id))]),
    store.ownerNames([...new Set(mine.map((row) => row.owner_id))]),
    store.context(mine.map((row) => row.id)),
    store.leadNames(caller.orgId, [...new Set(named.map((row) => row.lead_contact_id).filter((id): id is string => Boolean(id)))]),
    store.asks(caller.orgId, named.map((row) => row.id)),
    store.texts(caller.orgId),
    caller.role === "admin" ? store.clientsOn(caller.orgId) : Promise.resolve(false),
  ]);
  const canAddClient = caller.role === "admin" && clientsOn;
  const recorderIds = [...new Set(asks.filter((ask) => isRecordedAnswer(ask) && ask.sent_by).map((ask) => ask.sent_by as string))];
  const recorders = recorderIds.length ? await store.ownerNames(recorderIds) : new Map<string, string>();
  // The "recent" flag is for an admin's Home only (D-82): nobody else is told even that much about when a lead answered.
  const askByProposal = askViews(asks, leadNames, store.now(), caller.role === "admin", recorders);
  const ownIds = new Set(mine.filter((row) => row.owner_id === caller.profileId).map((row) => row.id));
  const titles = await store.itemTitles([...new Set(context.filter((c) => ownIds.has(c.proposal_id)).map((c) => c.work_item_id))]);
  // PR 4b: whether each of the caller's own proposals has a lead with a login to send the documents to.
  const ownLeads = [...new Set(mine.filter((row) => ownIds.has(row.id) && row.lead_contact_id).map((row) => row.lead_contact_id as string))];
  const linked = ownLeads.length && store.leadLinks ? await store.leadLinks(caller.orgId, ownLeads).catch(() => new Set<string>()) : new Set<string>();
  const ownLed = mine.filter((row) => ownIds.has(row.id) && row.lead_contact_id && row.status === "open").map((row) => row.id);
  // Phase 5: approvals go to the same people who are told who the lead is: admins, leads and the person who started it.
  const approvals = named.length && store.approvals ? await store.approvals(caller.orgId, named.map((row) => row.id)).catch(() => new Map<string, ApprovalView>()) : new Map<string, ApprovalView>();
  // QA M2 of PR 303: a Member reads the admin's note and the final's title through the Member rules.
  for (const [id, view] of approvals) approvals.set(id, approvalForReader(view, caller.role));
  const sentDocs = ownLed.length && store.leadDocsSent ? await store.leadDocsSent(caller.orgId, ownLed).catch(() => new Map<string, SentDocs>()) : new Map<string, SentDocs>();
  const proposals: DeskProposal[] = mine.map((row) => {
    const items = context.filter((c) => c.proposal_id === row.id);
    const own = row.owner_id === caller.profileId;
    return {
      id: row.id,
      title: row.title,
      clientName: clientNames.get(row.client_id) ?? "",
      ownerName: ownerNames.get(row.owner_id) ?? "",
      mine: own,
      status: row.status as ProposalStatus,
      receivedAt: row.received_at,
      sentAt: row.sent_at,
      decidedAt: row.decided_at,
      engagementId: row.engagement_id,
      dueOn: row.client_due_on ?? null,
      contextCount: items.length,
      canAct: own || all,
      canClose: row.status === "open" && (own || all),
      canArchive: row.status !== "won" && caller.role === "admin",
      ...(pickers ? { leadContactId: row.lead_contact_id ?? null } : {}),
      ...(pickers || own ? { leadName: (row.lead_contact_id ? leadNames.get(row.lead_contact_id) : null) ?? null, ask: askByProposal.get(row.id) ?? null } : {}),
      ...(own ? { contextTitles: items.map((c) => titles.get(c.work_item_id) ?? "").filter(Boolean) } : {}),
      ...(approvals.has(row.id) ? { approval: approvals.get(row.id)! } : {}),
      ...(own && row.status === "open" && row.lead_contact_id
        ? (() => {
            const ids = items.map((c) => c.work_item_id);
            const state = sendState(row, sentDocs.get(row.id), ids, linked.has(row.lead_contact_id));
            const sentIds = sentDocs.get(row.id)?.item_ids ?? [];
            return { leadDocs: state, ...(state === "more" ? { leadDocsAdded: ids.filter((id) => !sentIds.includes(id)).length } : {}) };
          })()
        : {}),
    };
  });
  return { goalHours: goalHours(settings), canSetGoal: caller.role === "admin", canPickLead: pickers, canAddClient, clientsOff: caller.role === "admin" && !clientsOn, texts, proposals };
}

/** The clients a new proposal can be for. */
export async function listDeskClients(store: DeskStore): Promise<DeskClient[]> {
  const caller = await store.caller();
  return (await store.clients(caller.orgId)).sort((a, b) => a.name.localeCompare(b.name));
}

/** Starts a proposal: a row, its client, its context documents. No board. */
export async function createProposal(store: DeskStore, input: NewProposalInput): Promise<NewProposalResult> {
  const caller = await store.caller();
  const problems = INTAKE_COPY.problems;

  // 1. The documents must be this person's own, in this workspace. Checked before anything is written.
  if (input.work_item_ids.length > 0) {
    const owned = new Set(await store.ownedItems(caller.orgId, caller.profileId, input.work_item_ids));
    if (input.work_item_ids.some((id) => !owned.has(id))) return { ok: false, problem: problems.notYours };
  }

  // 2. The client: one we have, or a new one. A new name that matches an existing client is that client.
  const clients = await store.clients(caller.orgId);
  let clientId: string | null = null;
  let madeClient = false;
  if (input.client_id) {
    clientId = clients.some((c) => c.id === input.client_id) ? input.client_id : null;
    if (!clientId) return { ok: false, problem: problems.clientGone };
  } else if (input.new_client_name) {
    const name = input.new_client_name;
    clientId = clients.find((c) => sameClientName(c.name, name))?.id ?? null;
    if (!clientId) {
      // Said plainly, and before anything is written: the database would refuse it anyway.
      if (!(await mayAddClient(store, caller))) return { ok: false, problem: problems.adminAddsClients };
      clientId = await store.createClient(caller.orgId, name);
      madeClient = clientId !== null;
    }
  }
  if (!clientId) return { ok: false, problem: problems.failed };

  // 3. The row, then its documents. If either fails, nothing is left behind.
  const id = store.newId();
  const undo = async () => {
    await store.removeProposal(id);
    if (madeClient && clientId) await store.removeClient(clientId);
  };
  const written = await store.insertProposal({ id, org_id: caller.orgId, client_id: clientId, title: input.title, notes: input.notes, owner_id: caller.profileId, ...(input.client_due_on ? { client_due_on: input.client_due_on } : {}) });
  if (!written) {
    if (madeClient) await store.removeClient(clientId);
    return { ok: false, problem: problems.failed };
  }
  if (input.work_item_ids.length > 0) {
    const listed = await store.insertContext(input.work_item_ids.map((workItemId, position) => ({ proposal_id: id, work_item_id: workItemId, position })));
    if (!listed) {
      await undo();
      return { ok: false, problem: problems.failed };
    }
  }

  try {
    await store.record(caller, "proposal.created", {
      client: madeClient ? "new" : "existing",
      documents: countBand(input.work_item_ids.length),
      notes: input.notes ? "yes" : "no",
    });
  } catch {
    /* the proposal exists; a recording fault never undoes it */
  }
  return { ok: true, id };
}

/** Whether this person may change this proposal: it is in their workspace, and they started it or are an admin or lead. */
export function mayAct(caller: DeskCaller, row: ProposalRow | null): row is ProposalRow {
  return row !== null && row.org_id === caller.orgId && (row.owner_id === caller.profileId || seesAllProposals(caller.role));
}

/**
 * Picks the lead on an open proposal from the workspace's roster, or clears it. Admins and leads only: they are the
 * people who may see the roster. The person must be on this workspace's own list. Picking a lead sends nothing.
 */
export async function setProposalLead(store: DeskStore, input: LeadInput): Promise<LeadResult> {
  const caller = await store.caller();
  if (!canManageRoster(caller.role)) return { ok: false, problem: LEAD_COPY.notAllowed };
  const row = await store.proposal(input.proposal_id);
  // Another workspace's proposal and one that does not exist read the same.
  if (!row || row.org_id !== caller.orgId) return { ok: false, problem: LEAD_COPY.notAllowed };
  if (row.status !== "open") return { ok: false, problem: LEAD_COPY.closed };
  if ((row.lead_contact_id ?? null) === input.lead_contact_id) return { ok: true };
  if (input.lead_contact_id && !(await store.rosterHas(caller.orgId, input.lead_contact_id))) return { ok: false, problem: LEAD_COPY.missing };
  if (!(await store.setLead(row.id, input.lead_contact_id))) return { ok: false, problem: LEAD_COPY.failed };
  try {
    await store.record(caller, "proposal.lead_set", { change: input.lead_contact_id ? "set" : "cleared" });
  } catch {
    /* the pick is saved; a recording fault never undoes it */
  }
  return { ok: true };
}

/**
 * Closes an open proposal as lost (the person who started it, an admin or a lead), or archives one made by mistake
 * (an admin). Neither makes a board, sends anything or deletes anything. A won proposal has a board and is left alone.
 */
export async function closeProposal(store: DeskStore, input: CloseInput): Promise<CloseResult> {
  const caller = await store.caller();
  const row = await store.proposal(input.proposal_id);
  // Someone else's proposal and one that does not exist read the same, so an id cannot be probed.
  if (!mayAct(caller, row) || row.archived_at) return { ok: false, problem: CLOSE_COPY.notYours };
  if (row.status === "won") return { ok: false, problem: CLOSE_COPY.won };
  const now = store.now().toISOString();
  if (input.change === "archived") {
    if (caller.role !== "admin") return { ok: false, problem: CLOSE_COPY.adminOnly };
    if (!(await store.archive(row.id, now))) return { ok: false, problem: CLOSE_COPY.failed };
  } else {
    if (row.status !== "open") return { ok: false, problem: CLOSE_COPY.decided };
    if (!(await store.closeLost(row.id, now))) return { ok: false, problem: CLOSE_COPY.failed };
  }
  await closeWaiting(store, row.id, now);
  try {
    await store.record(caller, "proposal.closed", { change: input.change });
  } catch {
    /* the change is saved; a recording fault never undoes it */
  }
  return { ok: true };
}

/** A request left waiting on a closed proposal is closed too. Best effort: the close is saved either way, and every
 * reader already leaves archived and decided proposals out. */
async function closeWaiting(store: DeskStore, proposalId: string, at: string): Promise<void> {
  try {
    await store.closeApprovals?.(proposalId, at);
  } catch {
    /* the proposal change stands */
  }
}

/** Saves the workspace's turnaround goal: an admin, and only that one setting. */
export async function setGoal(store: DeskStore, input: GoalInput): Promise<GoalResult> {
  const caller = await store.caller();
  if (caller.role !== "admin") return { ok: false, problem: GOAL_COPY.failed };
  return (await store.saveSetting(caller.orgId, GOAL_SETTING_KEY, input.hours)) ? { ok: true } : { ok: false, problem: GOAL_COPY.failed };
}

/**
 * What the strip at the top of a board says, for a board made by a win: that the proposal was won and when, who the
 * lead is, and the lead's answer once there is one. For members of the workspace who can open the board; the lead
 * gets no login and no seat by being named. A board that did not come from a proposal says nothing.
 */
export async function boardWin(store: DeskStore, input: BoardInput): Promise<BoardWin> {
  const caller = await store.caller();
  const board = await store.board(input.engagement_id);
  if (!board || board.orgId !== caller.orgId) return { won: false };
  const row = await store.boardProposal(caller.orgId, input.engagement_id);
  if (!row || row.org_id !== caller.orgId || row.status !== "won" || row.archived_at) return { won: false };
  const contactId = row.lead_contact_id ?? null;
  const [names, asks] = await Promise.all([contactId ? store.leadNames(caller.orgId, [contactId]) : Promise.resolve(new Map<string, string>()), contactId ? store.asks(caller.orgId, [row.id]) : Promise.resolve([])]);
  const leadName = contactId ? (names.get(contactId) ?? null) : null;
  // An answer from the person named comes first. A text sent to a demo number is never shown as theirs.
  const answered = asks.find((ask) => ask.contact_id === contactId && (ask.reply === "yes" || ask.reply === "no"));
  const recorder = answered && isRecordedAnswer(answered) && answered.sent_by ? await store.ownerNames([answered.sent_by]) : new Map<string, string>();
  let ask = leadName && answered ? (askViews([answered], names, store.now(), false, recorder).get(row.id) ?? null) : null;
  // Otherwise, in a demo workspace while texting is not switched on, the latest practice answer, marked as practice
  // and not put in the lead's name. Never in a real workspace, and never once the sender settings are in place.
  if (leadName && !ask) {
    const practised = asks.find((entry) => entry.status === "practice" && (entry.reply === "yes" || entry.reply === "no"));
    if (practised) {
      const texts = await store.texts(caller.orgId);
      if (texts.demo && !texts.connected) ask = askViews([practised], names, store.now()).get(row.id) ?? null;
    }
  }
  return { won: true, decidedAt: row.decided_at, leadName, ask };
}

/** Marks an open proposal as gone out to the client, which stops the clock, or takes that back. */
export async function setProposalSent(store: DeskStore, input: SentInput): Promise<SentResult> {
  const caller = await store.caller();
  const row = await store.proposal(input.proposal_id);
  // Someone else's proposal and one that does not exist read the same, so an id cannot be probed.
  if (!mayAct(caller, row)) return { ok: false, problem: SENT_COPY.notYours };
  if (row.status !== "open") return { ok: false, problem: SENT_COPY.closed };
  if (Boolean(row.sent_at) === input.sent) return { ok: true };
  const now = store.now();
  const sentAt = input.sent ? new Date(Math.max(now.getTime(), Date.parse(row.received_at) || 0)).toISOString() : null;
  if (!(await store.setSent(row.id, sentAt))) return { ok: false, problem: SENT_COPY.failed };
  try {
    const goal = goalHours(await store.settings(caller.orgId));
    const left = sentAt ? timeLeft({ receivedAt: row.received_at, sentAt, goalHours: goal, now }) : null;
    await store.record(caller, "proposal.sent", {
      change: input.sent ? "sent" : "unsent",
      within_goal: left && left.state === "sent" ? (left.withinGoal ? "yes" : "no") : "na",
    });
  } catch {
    /* the change is saved; a recording fault never undoes it */
  }
  return { ok: true };
}

/**
 * Records the win. This is the moment the team board comes to exist (D-37): the board is made for the proposal's
 * client, the salesperson's notes become its brief, and their context documents go on it first, in their order.
 *
 * Only the person who started the proposal may do this, because it puts their own documents where a team can open
 * them; an admin or lead cannot do it on their behalf. The board is not shared with the firm: that stays a choice
 * made on the board. Everything is made before the proposal is marked won, and taken back if any step fails, so a
 * failure leaves the proposal open and no half-made board.
 */
export async function winProposal(store: DeskStore, input: WinInput): Promise<WinResult> {
  const caller = await store.caller();
  const row = await store.proposal(input.proposal_id);
  if (!row || row.org_id !== caller.orgId || row.owner_id !== caller.profileId) return { ok: false, problem: WIN_COPY.notYours };
  // A second press, or a second tab: the board already exists, so hand it back.
  if (row.status === "won" && row.engagement_id) return { ok: true, engagementId: row.engagement_id };
  if (row.status !== "open") return { ok: false, problem: WIN_COPY.lost };

  const listed = (await store.context([row.id])).filter((c) => c.proposal_id === row.id).map((c) => c.work_item_id);
  // A document deleted since, or no longer this person's, is left out rather than failing the win.
  const still = new Set(listed.length > 0 ? await store.ownedItems(caller.orgId, caller.profileId, listed) : []);
  const items = listed.filter((id) => still.has(id));
  const notes = (await store.notes(row.id))?.trim() || null;

  const now = store.now();
  const engagementId = store.newId();
  if (!(await store.makeBoard({ id: engagementId, orgId: caller.orgId, title: row.title, clientId: row.client_id, brief: notes, ownerId: caller.profileId }))) {
    return { ok: false, problem: WIN_COPY.failed };
  }
  const undo = async (): Promise<WinResult> => {
    try {
      await store.removeBoard(engagementId);
    } catch {
      /* nothing more can be done from here */
    }
    return { ok: false, problem: WIN_COPY.failed };
  };
  try {
    const home = await store.boardHome(engagementId);
    if (!home) return await undo();
    if (items.length > 0 && !(await store.placeItems(home, items, now))) return await undo();
    const received = Date.parse(row.received_at);
    const sent = row.sent_at ? Date.parse(row.sent_at) : NaN;
    const ledger: Parameters<DeskStore["writeLedger"]>[0] = [
      { org_id: caller.orgId, engagement_id: engagementId, kind: "brief_received", occurred_at: new Date(Number.isFinite(received) ? Math.min(received, now.getTime()) : now.getTime()).toISOString() },
      ...(Number.isFinite(sent) ? [{ org_id: caller.orgId, engagement_id: engagementId, kind: "sent_to_client" as const, occurred_at: new Date(Math.min(sent, now.getTime())).toISOString() }] : []),
      { org_id: caller.orgId, engagement_id: engagementId, kind: "won", occurred_at: now.toISOString() },
    ];
    if (!(await store.writeLedger(ledger))) return await undo();
    if (!(await store.claimWin(row.id, engagementId, now.toISOString()))) {
      // Someone got there first. Their board stands; this one goes.
      await undo();
      const after = await store.proposal(row.id);
      return after && after.status === "won" && after.engagement_id ? { ok: true, engagementId: after.engagement_id } : { ok: false, problem: WIN_COPY.failed };
    }
    await closeWaiting(store, row.id, now.toISOString());
  } catch {
    return await undo();
  }
  try {
    await store.record(caller, "proposal.won", { documents: countBand(items.length), notes: notes ? "yes" : "no", sent_first: row.sent_at ? "yes" : "no" });
  } catch {
    /* the win is saved; a recording fault never undoes it */
  }
  return { ok: true, engagementId };
}

/* ---------------------------------------------------------------------------
 * The real outside world. Kept thin: every rule is above.
 * ------------------------------------------------------------------------- */

export type DeskContext = { supabase: Db; userId: string };

const BASE_COLUMNS = "id, org_id, client_id, title, owner_id, received_at, sent_at, status, decided_at, engagement_id, lead_contact_id";
/** `archived_at` arrives with the 20 Nov migration. Until it is applied, reads fall back to the columns before it. */
const PROPOSAL_COLUMNS = `${BASE_COLUMNS}, archived_at`;
/** `client_due_on` arrives with PR 3a's migration. Until it is applied, reads fall back to the columns before it. */
const DUE_COLUMNS = `${PROPOSAL_COLUMNS}, client_due_on`;

export async function realStore(context: DeskContext, profileId: string | null): Promise<DeskStore> {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, profileId);
  const caller: DeskCaller = { profileId: profile.id, orgId: profile.org_id, role: profile.role, userId: context.userId };
  const own = context.supabase;
  const ownLoose = own as unknown as LooseDb;
  const adminLoose = supabaseAdmin as unknown as LooseDb;
  const removeBoard = async (id: string): Promise<void> => {
    // Archived first: the database will not take an owner off a live board, and a board that cannot be deleted stays hidden.
    await supabaseAdmin.from("engagements").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("org_id", caller.orgId);
    await supabaseAdmin.from("engagements").delete().eq("id", id).eq("org_id", caller.orgId);
  };
  return {
    caller: async () => caller,
    async settings(orgId) {
      const { data } = await own.from("orgs").select("settings").eq("id", orgId).maybeSingle();
      return data?.settings ?? null;
    },
    async proposals(orgId) {
      const read = (columns: string) => ownLoose.from("proposals").select(columns).eq("org_id", orgId).order("received_at", { ascending: false }).limit(500);
      let { data, error } = await read(DUE_COLUMNS);
      if (error) ({ data, error } = await read(PROPOSAL_COLUMNS));
      if (error) ({ data, error } = await read(BASE_COLUMNS));
      return error ? null : ((data ?? []) as unknown as ProposalRow[]);
    },
    async clientNames(ids) {
      if (ids.length === 0) return new Map();
      const { data } = await own.from("clients").select("id, name").in("id", ids);
      return new Map((data ?? []).map((row) => [row.id, row.name]));
    },
    async ownerNames(ids) {
      if (ids.length === 0) return new Map();
      const { data } = await own.from("profiles").select("id, display_name").in("id", ids);
      return new Map((data ?? []).map((row) => [row.id, row.display_name]));
    },
    async context(proposalIds) {
      if (proposalIds.length === 0) return [];
      const { data } = await ownLoose.from("proposal_context_items").select("proposal_id, work_item_id, position").in("proposal_id", proposalIds).order("position", { ascending: true });
      return (data ?? []) as { proposal_id: string; work_item_id: string }[];
    },
    async itemTitles(ids) {
      if (ids.length === 0) return new Map();
      const { data } = await own.from("work_items").select("id, title, display_title").in("id", ids);
      return new Map((data ?? []).map((row) => [row.id, row.display_title || row.title]));
    },
    async clients(orgId) {
      const { data } = await own.from("clients").select("id, name, kind, quick_folder, archived_at").eq("org_id", orgId).is("archived_at", null).limit(1000);
      return (data ?? []).filter((row) => row.kind === "client" && !row.quick_folder).map((row) => ({ id: row.id, name: row.name }));
    },
    async createClient(orgId, name) {
      const id = crypto.randomUUID();
      // The person's own client, so the app's existing rule for who may add a client decides.
      const { error } = await own.from("clients").insert({ id, org_id: orgId, name });
      return error ? null : id;
    },
    async removeClient(id) {
      await supabaseAdmin.from("clients").delete().eq("id", id).eq("org_id", caller.orgId);
    },
    async ownedItems(orgId, ownerId, ids) {
      const { data } = await supabaseAdmin.from("work_items").select("id").eq("org_id", orgId).eq("owner_id", ownerId).in("id", ids);
      return (data ?? []).map((row) => row.id);
    },
    async insertProposal(row) {
      const { error } = await adminLoose.from("proposals").insert(row);
      // Before the due date's column is added (Liam pastes the SQL), the proposal is still made, without the date.
      // QA M2 of PR 295: PostgREST answers an unknown column with PGRST204, Postgres with 42703; both mean "not there yet".
      if (error && row.client_due_on && ["42703", "PGRST204"].includes(String((error as { code?: string }).code))) {
        const { client_due_on: _dropped, ...rest } = row;
        const retry = await adminLoose.from("proposals").insert(rest);
        return !retry.error;
      }
      return !error;
    },
    async insertContext(rows) {
      const { error } = await adminLoose.from("proposal_context_items").insert(rows);
      return !error;
    },
    async removeProposal(id) {
      await adminLoose.from("proposals").delete().eq("id", id).eq("org_id", caller.orgId);
    },
    async proposal(id) {
      let { data, error } = await adminLoose.from("proposals").select(DUE_COLUMNS).eq("id", id).maybeSingle();
      if (error) ({ data, error } = await adminLoose.from("proposals").select(PROPOSAL_COLUMNS).eq("id", id).maybeSingle());
      if (error) ({ data, error } = await adminLoose.from("proposals").select(BASE_COLUMNS).eq("id", id).maybeSingle());
      return (data as unknown as ProposalRow | null) ?? null;
    },
    async setSent(id, sentAt) {
      const { data, error } = await adminLoose.from("proposals").update({ sent_at: sentAt }).eq("id", id).eq("org_id", caller.orgId).eq("status", "open").select("id");
      const ok = !error && (data ?? []).length === 1;
      // Phase 5: who marked it sent, in its own server-only table (QA L3 of PR 303); cleared with Undo sent. Best effort:
      // before that table exists, or if this write fails, the date alone stands.
      if (ok) {
        if (sentAt) await adminLoose.from("proposal_sent_marks").upsert({ proposal_id: id, org_id: caller.orgId, sent_by: caller.profileId, sent_at: sentAt }, { onConflict: "proposal_id" });
        else await adminLoose.from("proposal_sent_marks").delete().eq("proposal_id", id).eq("org_id", caller.orgId);
      }
      return ok;
    },
    async rosterHas(orgId, contactId) {
      const { data, error } = await adminLoose.from("roster_contacts").select("id").eq("id", contactId).eq("org_id", orgId).maybeSingle();
      return !error && Boolean(data);
    },
    async setLead(id, contactId) {
      const { data, error } = await adminLoose.from("proposals").update({ lead_contact_id: contactId }).eq("id", id).eq("org_id", caller.orgId).eq("status", "open").select("id");
      return !error && (data ?? []).length === 1;
    },
    async notes(id) {
      const { data } = await adminLoose.from("proposals").select("notes").eq("id", id).eq("org_id", caller.orgId).maybeSingle();
      return ((data as { notes: string | null } | null)?.notes) ?? null;
    },
    async makeBoard(board) {
      // The service role has no signed-in person, so the owner is named here; the database fills the board's code.
      const made = await supabaseAdmin.from("engagements").insert({ id: board.id, org_id: board.orgId, title: board.title, client_id: board.clientId, brief: board.brief, owner_id: board.ownerId, shared_with_firm: false } as never);
      if (made.error) return false;
      const joined = await supabaseAdmin.from("engagement_members").insert({ engagement_id: board.id, profile_id: board.ownerId, member_role: "em", added_by: board.ownerId } as never);
      if (!joined.error) return true;
      await removeBoard(board.id);
      return false;
    },
    async boardHome(engagementId) {
      const { data, error } = await own.rpc("ensure_board_default_task", { p_engagement: engagementId });
      return error || !data ? null : (data as unknown as string);
    },
    async placeItems(taskId, itemIds, at) {
      // One millisecond apart, so the order they were added in is the order the board has them.
      const { error } = await own.from("work_item_tasks").insert(itemIds.map((id, index) => ({ work_item_id: id, task_id: taskId, mapped_at: new Date(at.getTime() + index).toISOString() })));
      return !error;
    },
    async writeLedger(rows) {
      const { error } = await supabaseAdmin.from("proposal_ledger").insert(rows);
      return !error;
    },
    async claimWin(id, engagementId, decidedAt) {
      const { data, error } = await adminLoose.from("proposals").update({ status: "won", decided_at: decidedAt, engagement_id: engagementId }).eq("id", id).eq("org_id", caller.orgId).eq("owner_id", caller.profileId).eq("status", "open").select("id");
      return !error && (data ?? []).length === 1;
    },
    removeBoard,
    async leadNames(orgId, contactIds) {
      if (contactIds.length === 0) return new Map();
      const { data } = await adminLoose.from("roster_contacts").select("id, full_name").eq("org_id", orgId).in("id", contactIds);
      return new Map(((data ?? []) as { id: string; full_name: string }[]).map((person) => [person.id, person.full_name]));
    },
    async leadLinks(orgId, contactIds) {
      if (contactIds.length === 0) return new Set();
      const { data, error } = await adminLoose.from("roster_contacts").select("id, profile_id").eq("org_id", orgId).in("id", contactIds);
      if (error) return new Set();
      return new Set(((data ?? []) as { id: string; profile_id: string | null }[]).filter((row) => row.profile_id).map((row) => row.id));
    },
    async approvals(orgId, proposalIds) {
      const { readApprovalViews } = await import("./proposal-approval.server");
      return readApprovalViews(adminLoose, orgId, proposalIds);
    },
    async leadDocsSent(orgId, proposalIds) {
      if (proposalIds.length === 0) return new Map();
      const { data, error } = await adminLoose.from("proposal_lead_docs").select("proposal_id, contact_id, item_ids").eq("org_id", orgId).in("proposal_id", proposalIds);
      if (error) return new Map();
      return new Map(((data ?? []) as { proposal_id: string; contact_id: string; item_ids: string[] }[]).map((row) => [row.proposal_id, { contact_id: row.contact_id, item_ids: row.item_ids ?? [] }]));
    },
    async asks(orgId, proposalIds) {
      if (proposalIds.length === 0) return [];
      const { data, error } = await adminLoose.from("proposal_texts").select("proposal_id, contact_id, to_demo, status, reply, created_at, status_at, replied_at, sent_by").eq("org_id", orgId).eq("kind", "lead_ask").in("proposal_id", proposalIds).order("created_at", { ascending: false }).limit(1000);
      return error ? [] : ((data ?? []) as DeskAsk[]);
    },
    async texts(orgId) {
      const { data } = await supabaseAdmin.from("orgs").select("settings").eq("id", orgId).maybeSingle();
      const [{ isDemoWorkspace }, { readyTextConfig }] = await Promise.all([import("./demo-text-number-shared"), import("./text-sender.server")]);
      // Connected means able to send now (D-97), not just settings in place.
      return { demo: isDemoWorkspace(data?.settings), connected: (await readyTextConfig(adminLoose)) !== null };
    },
    async clientsOn(orgId) {
      const { data } = await supabaseAdmin.from("orgs").select("clients_enabled").eq("id", orgId).maybeSingle();
      return data?.clients_enabled === true;
    },
    async closeLost(id, decidedAt) {
      const { data, error } = await adminLoose.from("proposals").update({ status: "lost", decided_at: decidedAt }).eq("id", id).eq("org_id", caller.orgId).eq("status", "open").select("id");
      return !error && (data ?? []).length === 1;
    },
    async archive(id, at) {
      const { data, error } = await adminLoose.from("proposals").update({ archived_at: at }).eq("id", id).eq("org_id", caller.orgId).neq("status", "won").is("archived_at", null).select("id");
      return !error && (data ?? []).length === 1;
    },
    async closeApprovals(id, at) {
      // Only an open request changes (decision is null); decided ones are never touched. decided_by stays empty: the system closed it.
      await adminLoose.from("proposal_approvals").update({ decision: "withdrawn", decided_by: null, decided_at: at, note: null }).eq("proposal_id", id).eq("org_id", caller.orgId).is("decision", null);
    },
    async saveSetting(orgId, key, value) {
      if (orgId !== caller.orgId) return false;
      // Read just before writing, by the server, and only this one key is changed.
      const fresh = await supabaseAdmin.from("orgs").select("settings").eq("id", orgId).maybeSingle();
      const current = fresh.data?.settings;
      if (fresh.error || !fresh.data || (current !== null && (typeof current !== "object" || Array.isArray(current)))) return false;
      const merged = { ...((current as Record<string, unknown> | null) ?? {}), [key]: value };
      const written = await supabaseAdmin.from("orgs").update({ settings: merged as never }).eq("id", orgId).select("id");
      return !written.error && (written.data ?? []).length === 1;
    },
    async board(engagementId) {
      // Read as the signed-in person, so the database's own rule for who may open a board decides.
      const { data, error } = await own.from("engagements").select("id, org_id").eq("id", engagementId).maybeSingle();
      return error || !data ? null : { orgId: data.org_id };
    },
    async boardProposal(orgId, engagementId) {
      let { data, error } = await adminLoose.from("proposals").select(PROPOSAL_COLUMNS).eq("org_id", orgId).eq("engagement_id", engagementId).maybeSingle();
      if (error) ({ data, error } = await adminLoose.from("proposals").select(BASE_COLUMNS).eq("org_id", orgId).eq("engagement_id", engagementId).maybeSingle());
      return (data as unknown as ProposalRow | null) ?? null;
    },
    now: () => new Date(),
    async record(who, eventType, dims) {
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabaseAdmin, { eventType, orgId: who.orgId, userId: who.userId, profileId: who.profileId, dims });
    },
    newId: () => crypto.randomUUID(),
  };
}

/** The server functions' handlers. The functions file only wires them up, so these are what the tests call. */
export const deskHandlers = {
  async list(context: DeskContext, data: DeskProfileInput): Promise<DeskList> {
    return listDesk(await realStore(context, data.profile_id));
  },
  async clients(context: DeskContext, data: DeskProfileInput): Promise<DeskClient[]> {
    return listDeskClients(await realStore(context, data.profile_id));
  },
  async create(context: DeskContext, data: NewProposalInput): Promise<NewProposalResult> {
    return createProposal(await realStore(context, data.profile_id), data);
  },
  async sent(context: DeskContext, data: SentInput): Promise<SentResult> {
    return setProposalSent(await realStore(context, data.profile_id), data);
  },
  async lead(context: DeskContext, data: LeadInput): Promise<LeadResult> {
    return setProposalLead(await realStore(context, data.profile_id), data);
  },
  async win(context: DeskContext, data: WinInput): Promise<WinResult> {
    return winProposal(await realStore(context, data.profile_id), data);
  },
  async close(context: DeskContext, data: CloseInput): Promise<CloseResult> {
    return closeProposal(await realStore(context, data.profile_id), data);
  },
  async goal(context: DeskContext, data: GoalInput): Promise<GoalResult> {
    return setGoal(await realStore(context, data.profile_id), data);
  },
  async boardWin(context: DeskContext, data: BoardInput): Promise<BoardWin> {
    return boardWin(await realStore(context, data.profile_id), data);
  },
};
