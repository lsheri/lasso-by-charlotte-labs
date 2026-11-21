/**
 * 21 Nov 2026, chat pill PR 4b (D-97): the Lead's view, server side. Rules first, each taking its outside world as
 * `LeadStore` so it is tested without a database; the real store is at the end.
 *
 * Who: a teammate (requireFirmMember: an active member of a company workspace, never a coach or a guest) whose login
 * is linked to the People row that is a proposal's lead. Everything is read with the service role after that check,
 * inside the caller's workspace, and read fresh each time: a lead who is unlinked, changed or whose proposal closes
 * loses it on the next read. Documents need the owner's send to this same lead. Amounts are withheld for Members.
 * Events carry a count band, never a title, a client, a name or words.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  docsSentToLead,
  LEAD_DOC_MAX_CHARS,
  LEAD_PAST_WORK_SHOWN,
  LEAD_VIEW_COPY,
  SEND_DOCS_COPY,
  type LeadDocInput,
  type LeadDocResult,
  type LedInput,
  type LedList,
  type LedProposal,
  type SendDocsInput,
  type SendDocsResult,
} from "./lead-view-shared";
import { countBand, goalHours, sameClientName } from "./proposal-desk-shared";
import { seesMoney } from "./money-mask-shared";

type Db = SupabaseClient<Database>;

export type LeadCaller = { profileId: string; orgId: string; role: string; userId: string };

export type LeadProposalRow = {
  id: string;
  org_id: string;
  client_id: string;
  title: string;
  owner_id: string;
  received_at: string;
  sent_at: string | null;
  status: string;
  archived_at?: string | null;
  lead_contact_id?: string | null;
  client_due_on?: string | null;
  notes?: string | null;
  /** The People row the documents were sent to. Absent before PR 4b's column exists. */
  lead_docs_to?: string | null;
};

export type LeadStore = {
  caller: () => Promise<LeadCaller>;
  /** Ids of this workspace's People rows linked to this teammate. "absent" before PR 4a's column; null on a failed read. */
  myContacts: (orgId: string, profileId: string) => Promise<string[] | "absent" | null>;
  /** Open, unarchived proposals in this workspace led by these People rows. Null on a failed read. */
  ledProposals: (orgId: string, contactIds: string[]) => Promise<LeadProposalRow[] | null>;
  proposal: (id: string) => Promise<LeadProposalRow | null>;
  /** These People rows of this workspace, with the teammate each is linked to. */
  contacts: (orgId: string, ids: string[]) => Promise<{ id: string; profile_id: string | null }[]>;
  clientNames: (ids: string[]) => Promise<Map<string, string>>;
  personNames: (ids: string[]) => Promise<Map<string, string>>;
  context: (proposalIds: string[]) => Promise<{ proposal_id: string; work_item_id: string }[]>;
  /** Of these work items, the ones in this workspace owned by this person, with titles. */
  ownedItems: (orgId: string, ownerId: string, ids: string[]) => Promise<{ id: string; title: string }[]>;
  settings: (orgId: string) => Promise<unknown>;
  /** Boards of this workspace shared with the firm and not archived, with their client's name. */
  sharedBoards: (orgId: string) => Promise<{ id: string; title: string; client: string | null; created_at: string }[]>;
  /** The words of one work item in this workspace. Null when it has none or cannot be read. */
  itemText: (orgId: string, itemId: string) => Promise<string | null>;
  /** Sets or clears who the documents went to, on an open proposal in this workspace. */
  setDocs: (id: string, orgId: string, to: string | null, at: string | null) => Promise<boolean | "absent">;
  record: (caller: LeadCaller, eventType: "proposal.docs_to_lead" | "lead_view.document_opened" | "proposal.final_chosen", dims: Record<string, string>) => Promise<void>;
  /** 21 Nov 2026, PR 4c: the latest final per proposal. "absent" before its table exists. Left out, none. */
  finals?: (orgId: string, proposalIds: string[]) => Promise<{ proposal_id: string; work_item_id: string; chosen_at: string }[] | "absent">;
  /** Titles of these work items in this workspace, whoever owns them. */
  itemTitles?: (orgId: string, ids: string[]) => Promise<Map<string, string>>;
  now: () => Date;
};

/** Amounts out of a Member's view: the fees section and every money figure, as the firm answers do. */
async function forReader(text: string, role: string): Promise<{ text: string; withheld: boolean }> {
  if (seesMoney(role)) return { text, withheld: false };
  const [{ maskFees }, { withoutFees }] = await Promise.all([import("./firm-ask-shared"), import("./firm-corpus-shared")]);
  const masked = maskFees(withoutFees(text));
  return { text: masked, withheld: masked !== text };
}

/** Whether this caller leads this row now: open, unarchived, in their workspace, and its lead linked to them. */
export async function leads(store: LeadStore, caller: LeadCaller, row: LeadProposalRow | null): Promise<boolean> {
  if (!row || row.org_id !== caller.orgId || row.status !== "open" || row.archived_at || !row.lead_contact_id) return false;
  const mine = await store.myContacts(caller.orgId, caller.profileId);
  return Array.isArray(mine) && mine.includes(row.lead_contact_id);
}

/** The proposals this person leads, Up next first on the page. Empty for anyone who leads none. */
export async function listLed(store: LeadStore): Promise<LedList> {
  const caller = await store.caller();
  const mine = await store.myContacts(caller.orgId, caller.profileId);
  if (mine === null) throw new Error("lead_view_unreadable");
  const settings = await store.settings(caller.orgId);
  const goal = goalHours(settings);
  if (mine === "absent" || mine.length === 0) return { goalHours: goal, proposals: [] };
  const read = await store.ledProposals(caller.orgId, mine);
  if (read === null) throw new Error("lead_view_unreadable");
  // The same rule again, so a read that returned too much cannot widen what is shown.
  const rows = read.filter((row) => row.org_id === caller.orgId && row.status === "open" && !row.archived_at && row.lead_contact_id && mine.includes(row.lead_contact_id));
  if (rows.length === 0) return { goalHours: goal, proposals: [] };
  const [clients, owners, context, boards, finalRows] = await Promise.all([
    store.clientNames([...new Set(rows.map((row) => row.client_id))]),
    store.personNames([...new Set(rows.map((row) => row.owner_id))]),
    store.context(rows.map((row) => row.id)),
    store.sharedBoards(caller.orgId),
    store.finals ? store.finals(caller.orgId, rows.map((row) => row.id)).catch(() => "absent" as const) : Promise.resolve("absent" as const),
  ]);
  const finals = finalRows === "absent" ? [] : finalRows;
  const finalTitles = finals.length && store.itemTitles ? await store.itemTitles(caller.orgId, [...new Set(finals.map((row) => row.work_item_id))]) : new Map<string, string>();
  const proposals: LedProposal[] = [];
  for (const row of rows) {
    const listed = context.filter((entry) => entry.proposal_id === row.id).map((entry) => entry.work_item_id);
    // Only the owner's own work counts as the proposal's documents, as the win treats them.
    const owned = listed.length ? await store.ownedItems(caller.orgId, row.owner_id, listed) : [];
    const ordered = listed.map((itemId) => owned.find((item) => item.id === itemId)).filter((item): item is { id: string; title: string } => Boolean(item));
    const clientName = clients.get(row.client_id) ?? "";
    const brief = row.notes?.trim() ? (await forReader(row.notes.trim(), caller.role)).text : null;
    proposals.push({
      id: row.id,
      title: row.title,
      clientName,
      ownerName: owners.get(row.owner_id) ?? "",
      receivedAt: row.received_at,
      sentAt: row.sent_at,
      dueOn: row.client_due_on ?? null,
      brief,
      documents: docsSentToLead(row) ? ordered.map((item) => ({ id: item.id, title: item.title })) : null,
      documentCount: ordered.length,
      pastWork: clientName
        ? boards
            .filter((board) => board.client && sameClientName(board.client, clientName))
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, LEAD_PAST_WORK_SHOWN)
            .map((board) => ({ boardId: board.id, title: board.title }))
        : [],
      final: (() => {
        const latest = finals.filter((entry) => entry.proposal_id === row.id).sort((a, b) => b.chosen_at.localeCompare(a.chosen_at))[0];
        return latest ? { itemId: latest.work_item_id, title: finalTitles.get(latest.work_item_id) ?? "", chosenAt: latest.chosen_at } : null;
      })(),
    });
  }
  return { goalHours: goal, proposals };
}

/** One document, opened by the Lead. Every way it is not theirs to open reads the same. */
export async function readLeadDocument(store: LeadStore, input: LeadDocInput): Promise<LeadDocResult> {
  const caller = await store.caller();
  const gone = { ok: false as const, problem: LEAD_VIEW_COPY.docGone };
  const row = await store.proposal(input.proposal_id);
  if (!row || !(await leads(store, caller, row)) || !docsSentToLead(row)) return gone;
  const listed = (await store.context([row.id])).some((entry) => entry.proposal_id === row.id && entry.work_item_id === input.work_item_id);
  if (!listed) return gone;
  const [item] = await store.ownedItems(caller.orgId, row.owner_id, [input.work_item_id]);
  if (!item) return gone;
  const raw = await store.itemText(caller.orgId, item.id).catch(() => null);
  if (raw === null) return { ok: false, problem: LEAD_VIEW_COPY.docFailed };
  // A very long document opens at its start, said plainly; the dialog never carries a whole book.
  const clipped = raw.length > LEAD_DOC_MAX_CHARS ? `${raw.slice(0, LEAD_DOC_MAX_CHARS)}\n\n${LEAD_VIEW_COPY.clipped}` : raw;
  const shown = await forReader(clipped, caller.role);
  try {
    await store.record(caller, "lead_view.document_opened", { withheld: shown.withheld ? "yes" : "no" });
  } catch {
    /* opened; a recording fault changes nothing */
  }
  return { ok: true, title: item.title, text: shown.text, withheld: shown.withheld };
}

/**
 * The person who started a proposal sends its documents to the lead, or stops sharing them. Only them: the documents
 * are their own, and admins and leads see only a count. The lead must be a teammate with a login. Sends no text or
 * email; the Lead finds them on Home.
 */
export async function sendLeadDocuments(store: LeadStore, input: SendDocsInput): Promise<SendDocsResult> {
  const caller = await store.caller();
  const row = await store.proposal(input.proposal_id);
  if (!row || row.org_id !== caller.orgId || row.archived_at || row.owner_id !== caller.profileId) return { ok: false, problem: SEND_DOCS_COPY.ownerOnly };
  if (row.status !== "open") return { ok: false, problem: SEND_DOCS_COPY.closed };
  const now = store.now().toISOString();
  if (!input.send) {
    if (!row.lead_docs_to) return { ok: true };
    const cleared = await store.setDocs(row.id, caller.orgId, null, null);
    if (cleared === "absent") return { ok: false, problem: SEND_DOCS_COPY.notReady };
    return cleared ? { ok: true } : { ok: false, problem: SEND_DOCS_COPY.failed };
  }
  if (!row.lead_contact_id) return { ok: false, problem: SEND_DOCS_COPY.noLead };
  if (docsSentToLead(row)) return { ok: true };
  const [contact] = await store.contacts(caller.orgId, [row.lead_contact_id]);
  if (!contact?.profile_id) return { ok: false, problem: SEND_DOCS_COPY.noLogin("") };
  const listed = (await store.context([row.id])).filter((entry) => entry.proposal_id === row.id).map((entry) => entry.work_item_id);
  const owned = listed.length ? await store.ownedItems(caller.orgId, row.owner_id, listed) : [];
  if (owned.length === 0) return { ok: false, problem: SEND_DOCS_COPY.noDocs };
  const set = await store.setDocs(row.id, caller.orgId, row.lead_contact_id, now);
  if (set === "absent") return { ok: false, problem: SEND_DOCS_COPY.notReady };
  if (!set) return { ok: false, problem: SEND_DOCS_COPY.failed };
  try {
    await store.record(caller, "proposal.docs_to_lead", { documents: countBand(owned.length) });
  } catch {
    /* sent; a recording fault never undoes it */
  }
  return { ok: true };
}

/* ---------------------------------------------------------------------------
 * The real outside world. Kept thin: every rule is above.
 * ------------------------------------------------------------------------- */

export type LeadContext = { supabase: Db; userId: string };

const BASE = "id, org_id, client_id, title, owner_id, received_at, sent_at, status, archived_at, lead_contact_id, client_due_on, notes";
const WITH_DOCS = `${BASE}, lead_docs_to`;
const NOT_THERE = new Set(["42703", "PGRST204"]);

export async function realLeadStore(context: LeadContext, profileId: string | null): Promise<LeadStore> {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, profileId);
  const caller: LeadCaller = { profileId: profile.id, orgId: profile.org_id, role: String(profile.role ?? ""), userId: context.userId };
  const admin = supabaseAdmin as unknown as SupabaseClient;
  const withDocs = async <T extends { error: { code?: string } | null }>(run: (columns: string) => PromiseLike<T>): Promise<T> => {
    const first = await run(WITH_DOCS);
    return first.error && NOT_THERE.has(first.error.code ?? "") ? run(BASE) : first;
  };
  return {
    caller: async () => caller,
    async myContacts(orgId, me) {
      const { data, error } = await admin.from("roster_contacts").select("id").eq("org_id", orgId).eq("profile_id", me);
      if (error) return NOT_THERE.has(error.code ?? "") ? "absent" : null;
      return ((data ?? []) as { id: string }[]).map((row) => row.id);
    },
    async ledProposals(orgId, contactIds) {
      const { data, error } = await withDocs((columns) =>
        admin.from("proposals").select(columns).eq("org_id", orgId).eq("status", "open").is("archived_at", null).in("lead_contact_id", contactIds).order("received_at", { ascending: true }).limit(100),
      );
      return error ? null : ((data ?? []) as unknown as LeadProposalRow[]);
    },
    async proposal(id) {
      const { data, error } = await withDocs((columns) => admin.from("proposals").select(columns).eq("id", id).eq("org_id", caller.orgId).maybeSingle());
      return error ? null : ((data as unknown as LeadProposalRow | null) ?? null);
    },
    async contacts(orgId, ids) {
      if (!ids.length) return [];
      const { data } = await admin.from("roster_contacts").select("id, profile_id").eq("org_id", orgId).in("id", ids);
      return (data ?? []) as { id: string; profile_id: string | null }[];
    },
    async clientNames(ids) {
      if (!ids.length) return new Map();
      const { data } = await admin.from("clients").select("id, name").eq("org_id", caller.orgId).in("id", ids);
      return new Map(((data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
    },
    async personNames(ids) {
      if (!ids.length) return new Map();
      const { data } = await admin.from("profiles").select("id, display_name").eq("org_id", caller.orgId).in("id", ids);
      return new Map(((data ?? []) as { id: string; display_name: string }[]).map((row) => [row.id, row.display_name]));
    },
    async context(proposalIds) {
      if (!proposalIds.length) return [];
      const { data } = await admin.from("proposal_context_items").select("proposal_id, work_item_id, position").in("proposal_id", proposalIds).order("position", { ascending: true });
      return (data ?? []) as { proposal_id: string; work_item_id: string }[];
    },
    async ownedItems(orgId, ownerId, ids) {
      if (!ids.length) return [];
      const { data } = await admin.from("work_items").select("id, title, display_title").eq("org_id", orgId).eq("owner_id", ownerId).in("id", ids);
      return ((data ?? []) as { id: string; title: string; display_title: string | null }[]).map((row) => ({ id: row.id, title: row.display_title || row.title }));
    },
    async settings(orgId) {
      const { data } = await admin.from("orgs").select("settings").eq("id", orgId).maybeSingle();
      return (data as { settings?: unknown } | null)?.settings ?? null;
    },
    async sharedBoards(orgId) {
      const { data } = await admin.from("engagements").select("id, title, created_at, clients(name, quick_folder)").eq("org_id", orgId).eq("shared_with_firm", true).is("archived_at", null).limit(1000);
      return ((data ?? []) as unknown as { id: string; title: string; created_at: string; clients: { name: string; quick_folder: boolean } | null }[]).map((row) => ({
        id: row.id,
        title: row.title,
        created_at: row.created_at,
        client: row.clients && !row.clients.quick_folder ? row.clients.name : null,
      }));
    },
    async itemText(orgId, itemId) {
      const { getItemText, ITEM_TEXT_COLUMNS } = await import("./item-text.server");
      const { data, error } = await admin.from("work_items").select(ITEM_TEXT_COLUMNS).eq("id", itemId).eq("org_id", orgId).maybeSingle();
      if (error || !data) return null;
      const result = await getItemText(supabaseAdmin as never, data as never);
      return result.text ?? null;
    },
    async finals(orgId, proposalIds) {
      if (!proposalIds.length) return [];
      const { data, error } = await admin.from("proposal_final_versions").select("proposal_id, work_item_id, chosen_at").eq("org_id", orgId).in("proposal_id", proposalIds).order("chosen_at", { ascending: false }).limit(500);
      if (error) return "absent";
      return (data ?? []) as { proposal_id: string; work_item_id: string; chosen_at: string }[];
    },
    async itemTitles(orgId, ids) {
      if (!ids.length) return new Map();
      const { data } = await admin.from("work_items").select("id, title, display_title").eq("org_id", orgId).in("id", ids);
      return new Map(((data ?? []) as { id: string; title: string; display_title: string | null }[]).map((row) => [row.id, row.display_title || row.title]));
    },
    async setDocs(id, orgId, to, at) {
      const { data, error } = await admin.from("proposals").update({ lead_docs_to: to, lead_docs_at: at }).eq("id", id).eq("org_id", orgId).eq("status", "open").select("id");
      if (error) return NOT_THERE.has(error.code ?? "") ? "absent" : false;
      return (data ?? []).length === 1;
    },
    async record(who, eventType, dims) {
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabaseAdmin, { eventType, orgId: who.orgId, userId: who.userId, profileId: who.profileId, dims });
    },
    now: () => new Date(),
  };
}

export const leadViewHandlers = {
  async list(context: LeadContext, data: LedInput): Promise<LedList> {
    return listLed(await realLeadStore(context, data.profile_id));
  },
  async document(context: LeadContext, data: LeadDocInput): Promise<LeadDocResult> {
    return readLeadDocument(await realLeadStore(context, data.profile_id), data);
  },
  async sendDocs(context: LeadContext, data: SendDocsInput): Promise<SendDocsResult> {
    return sendLeadDocuments(await realLeadStore(context, data.profile_id), data);
  },
};
