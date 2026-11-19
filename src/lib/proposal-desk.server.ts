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

import {
  countBand,
  goalHours,
  INTAKE_COPY,
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
} from "./proposal-desk-shared";

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
};

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
  insertProposal: (row: { id: string; org_id: string; client_id: string; title: string; notes: string | null; owner_id: string }) => Promise<boolean>;
  insertContext: (rows: { proposal_id: string; work_item_id: string; position: number }[]) => Promise<boolean>;
  removeProposal: (id: string) => Promise<void>;
  record: (caller: DeskCaller, eventType: "proposal.created", dims: Record<string, string>) => Promise<void>;
  newId: () => string;
};

const isStatus = (value: string): value is ProposalStatus => (PROPOSAL_STATUSES as readonly string[]).includes(value);

/** The dashboard's rows. */
export async function listDesk(store: DeskStore): Promise<DeskList> {
  const caller = await store.caller();
  const all = seesAllProposals(caller.role);
  const rows = await store.proposals(caller.orgId);
  if (rows === null) throw new Error("proposals_unreadable");
  // The database already decided; this is the same rule again, so a policy mistake cannot widen what is shown.
  const mine = rows.filter((row) => row.org_id === caller.orgId && isStatus(row.status) && (all || row.owner_id === caller.profileId));
  const [settings, clientNames, ownerNames, context] = await Promise.all([
    store.settings(caller.orgId),
    store.clientNames([...new Set(mine.map((row) => row.client_id))]),
    store.ownerNames([...new Set(mine.map((row) => row.owner_id))]),
    store.context(mine.map((row) => row.id)),
  ]);
  const ownIds = new Set(mine.filter((row) => row.owner_id === caller.profileId).map((row) => row.id));
  const titles = await store.itemTitles([...new Set(context.filter((c) => ownIds.has(c.proposal_id)).map((c) => c.work_item_id))]);
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
      contextCount: items.length,
      ...(own ? { contextTitles: items.map((c) => titles.get(c.work_item_id) ?? "").filter(Boolean) } : {}),
    };
  });
  return { goalHours: goalHours(settings), canSetGoal: caller.role === "admin", proposals };
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
  const written = await store.insertProposal({ id, org_id: caller.orgId, client_id: clientId, title: input.title, notes: input.notes, owner_id: caller.profileId });
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

/* ---------------------------------------------------------------------------
 * The real outside world. Kept thin: every rule is above.
 * ------------------------------------------------------------------------- */

export type DeskContext = { supabase: Db; userId: string };

const PROPOSAL_COLUMNS = "id, org_id, client_id, title, owner_id, received_at, sent_at, status, decided_at, engagement_id";

export async function realStore(context: DeskContext, profileId: string | null): Promise<DeskStore> {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, profileId);
  const caller: DeskCaller = { profileId: profile.id, orgId: profile.org_id, role: profile.role, userId: context.userId };
  const own = context.supabase;
  const ownLoose = own as unknown as LooseDb;
  const adminLoose = supabaseAdmin as unknown as LooseDb;
  return {
    caller: async () => caller,
    async settings(orgId) {
      const { data } = await own.from("orgs").select("settings").eq("id", orgId).maybeSingle();
      return data?.settings ?? null;
    },
    async proposals(orgId) {
      const { data, error } = await ownLoose.from("proposals").select(PROPOSAL_COLUMNS).eq("org_id", orgId).order("received_at", { ascending: false }).limit(500);
      return error ? null : ((data ?? []) as ProposalRow[]);
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
      return !error;
    },
    async insertContext(rows) {
      const { error } = await adminLoose.from("proposal_context_items").insert(rows);
      return !error;
    },
    async removeProposal(id) {
      await adminLoose.from("proposals").delete().eq("id", id).eq("org_id", caller.orgId);
    },
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
};
