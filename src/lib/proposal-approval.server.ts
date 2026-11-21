/**
 * 21 Nov 2026, chat pill Phase 5 (D-97): the approval loop, server side. Rules first, with their outside world as
 * `ApprovalStore` (the final-version store plus the approval rows), so each is tested without a database.
 *
 * Who: sending (and taking back) is for the proposal's linked lead or the person who started it. Deciding is for an
 * admin who does not lead the proposal; with no other admin, the app says so. One open request per proposal (the
 * database's own unique index too). A request for a replaced version is refused. Approving marks the proposal as gone
 * to the client and stores who did. Nothing is texted until the carrier approves texts (Phase 6). Events carry the
 * decision only, never who or the note.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { leads, type LeadCaller, type LeadContext, type LeadProposalRow } from "./lead-view.server";
import { realFinalStore, type FinalStore } from "./proposal-final.server";
import { goalHours, timeLeft } from "./proposal-desk-shared";
import {
  APPROVAL_COPY,
  approvalViews,
  mayDecide,
  type ApprovalAskInput,
  type ApprovalDecideInput,
  type ApprovalFinalInput,
  type ApprovalResult,
  type ApprovalRow,
  type ApprovalView,
} from "./proposal-approval-shared";

export type ApprovalStore = FinalStore & {
  /** This proposal's final versions, newest first. "absent" before 4c's table exists. */
  finalVersions: (orgId: string, proposalId: string) => Promise<{ id: string; work_item_id: string }[] | "absent">;
  /** Approval rows for these proposals in this workspace. "absent" before Phase 5's table exists. */
  approvalRows: (orgId: string, proposalIds: string[]) => Promise<ApprovalRow[] | "absent">;
  /** Adds an open request. "taken" when one is already open (the unique index). */
  insertApproval: (row: { org_id: string; proposal_id: string; final_version_id: string; requested_by: string; requested_at: string }) => Promise<"ok" | "taken" | "absent" | null>;
  /** Decides an open request, only while it is still open. False when it was not open any more. */
  decide: (id: string, orgId: string, patch: { decision: "approved" | "changes_asked" | "withdrawn"; decided_by: string; decided_at: string; note: string | null }) => Promise<boolean>;
  /** Marks an open proposal as gone to the client by this person. */
  markSent: (proposalId: string, orgId: string, at: string, by: string) => Promise<boolean>;
  /** How many active admins this workspace has besides this person. */
  otherAdmins: (orgId: string, except: string) => Promise<number>;
};

async function openRequest(store: ApprovalStore, caller: LeadCaller, proposalId: string): Promise<ApprovalRow | null | "absent"> {
  const rows = await store.approvalRows(caller.orgId, [proposalId]);
  if (rows === "absent") return "absent";
  return rows.find((row) => row.proposal_id === proposalId && row.decision === null) ?? null;
}

/** The Lead (or the person who started it) sends the latest final for approval, or takes an open request back. */
export async function askApproval(store: ApprovalStore, input: ApprovalAskInput): Promise<ApprovalResult> {
  const caller = await store.caller();
  const row = await store.proposal(input.proposal_id);
  if (!row || row.org_id !== caller.orgId) return { ok: false, problem: APPROVAL_COPY.notLead };
  if (row.status !== "open" || row.archived_at) return { ok: false, problem: APPROVAL_COPY.closed };
  if (row.owner_id !== caller.profileId && !(await leads(store, caller, row))) return { ok: false, problem: APPROVAL_COPY.notLead };
  const open = await openRequest(store, caller, row.id);
  if (open === "absent") return { ok: false, problem: APPROVAL_COPY.notReady };
  const now = store.now().toISOString();
  if (input.withdraw) {
    if (!open) return { ok: true };
    if (!(await store.decide(open.id, caller.orgId, { decision: "withdrawn", decided_by: caller.profileId, decided_at: now, note: null }))) return { ok: false, problem: APPROVAL_COPY.gone };
    await store.record(caller, "proposal.approval_decided", { decision: "withdrawn" }).catch(() => {});
    return { ok: true };
  }
  if (open) return { ok: false, problem: APPROVAL_COPY.already };
  const finals = await store.finalVersions(caller.orgId, row.id);
  if (finals === "absent") return { ok: false, problem: APPROVAL_COPY.notReady };
  const latest = finals[0];
  if (!latest) return { ok: false, problem: APPROVAL_COPY.needsFinal };
  const made = await store.insertApproval({ org_id: caller.orgId, proposal_id: row.id, final_version_id: latest.id, requested_by: caller.profileId, requested_at: now });
  if (made === "absent") return { ok: false, problem: APPROVAL_COPY.notReady };
  if (made === "taken") return { ok: false, problem: APPROVAL_COPY.already };
  if (made !== "ok") return { ok: false, problem: APPROVAL_COPY.failed };
  await store.record(caller, "proposal.approval_requested", {}).catch(() => {});
  return { ok: true };
}

/** An admin approves the request or asks for changes. Approving marks the proposal as gone to the client. */
export async function decideApproval(store: ApprovalStore, input: ApprovalDecideInput): Promise<ApprovalResult> {
  const caller = await store.caller();
  // Admins only, before anything is read.
  if (caller.role !== "admin") return { ok: false, problem: APPROVAL_COPY.adminsOnly };
  const row = await store.proposal(input.proposal_id);
  if (!row || row.org_id !== caller.orgId) return { ok: false, problem: APPROVAL_COPY.gone };
  if (row.status !== "open" || row.archived_at) return { ok: false, problem: APPROVAL_COPY.closed };
  const leadsIt = await leads(store, caller, row);
  if (!mayDecide(caller.role, leadsIt)) {
    const others = await store.otherAdmins(caller.orgId, caller.profileId).catch(() => 1);
    return { ok: false, problem: others === 0 ? APPROVAL_COPY.onlyAdmin : APPROVAL_COPY.ownRequest };
  }
  const open = await openRequest(store, caller, row.id);
  if (open === "absent") return { ok: false, problem: APPROVAL_COPY.notReady };
  if (!open || open.id !== input.approval_id) return { ok: false, problem: APPROVAL_COPY.gone };
  if (input.decision === "approved") {
    const finals = await store.finalVersions(caller.orgId, row.id);
    if (finals === "absent") return { ok: false, problem: APPROVAL_COPY.notReady };
    if (finals[0]?.id !== open.final_version_id) {
      const names = await store.personNames(open.requested_by ? [open.requested_by] : []);
      return { ok: false, problem: APPROVAL_COPY.stale(names.get(open.requested_by ?? "") ?? "") };
    }
  }
  const now = store.now();
  const at = now.toISOString();
  if (!(await store.decide(open.id, caller.orgId, { decision: input.decision, decided_by: caller.profileId, decided_at: at, note: input.decision === "changes_asked" ? input.note : null }))) {
    return { ok: false, problem: APPROVAL_COPY.gone };
  }
  await store.record(caller, "proposal.approval_decided", { decision: input.decision }).catch(() => {});
  if (input.decision === "approved" && !row.sent_at) {
    // The clock stops at approval. Never before the brief came in.
    const sentAt = new Date(Math.max(now.getTime(), Date.parse(row.received_at) || 0)).toISOString();
    if (await store.markSent(row.id, caller.orgId, sentAt, caller.profileId)) {
      const left = timeLeft({ receivedAt: row.received_at, sentAt, goalHours: goalHours(await store.settings(caller.orgId).catch(() => null)), now });
      await store.record(caller, "proposal.client_review", { within_goal: left.state === "sent" && left.withinGoal ? "yes" : "no" }).catch(() => {});
    }
  }
  return { ok: true };
}

/** The final an admin is asked to approve, as text. Admins only, while a request is open. */
export async function readFinalForApproval(store: ApprovalStore, input: ApprovalFinalInput): Promise<{ ok: true; title: string; text: string } | { ok: false; problem: string }> {
  const caller = await store.caller();
  if (caller.role !== "admin") return { ok: false, problem: APPROVAL_COPY.adminsOnly };
  const row = await store.proposal(input.proposal_id);
  if (!row || row.org_id !== caller.orgId) return { ok: false, problem: APPROVAL_COPY.gone };
  const open = await openRequest(store, caller, row.id);
  if (!open || open === "absent") return { ok: false, problem: APPROVAL_COPY.gone };
  const finals = await store.finalVersions(caller.orgId, row.id);
  const version = finals === "absent" ? undefined : finals.find((entry) => entry.id === open.final_version_id);
  if (!version) return { ok: false, problem: APPROVAL_COPY.gone };
  const item = await store.item(caller.orgId, version.work_item_id);
  if (!item) return { ok: false, problem: APPROVAL_COPY.gone };
  const text = await store.itemText(caller.orgId, item.id).catch(() => null);
  if (text === null) return { ok: false, problem: APPROVAL_COPY.failed };
  return { ok: true, title: item.title, text: text.slice(0, 50_000) };
}

/* ---------------------------------------------------------------------------
 * Reads shared by Proposals and the Lead's view, and the real store.
 * ------------------------------------------------------------------------- */

type Loose = SupabaseClient;
const ABSENT = new Set(["42P01", "PGRST205"]);

/** The latest request per proposal, as views. Empty before the tables exist or on a failed read. */
export async function readApprovalViews(admin: Loose, orgId: string, proposalIds: string[]): Promise<Map<string, ApprovalView>> {
  if (!proposalIds.length) return new Map();
  const { data: rows, error } = await admin.from("proposal_approvals").select("id, proposal_id, final_version_id, requested_by, requested_at, decision, decided_by, decided_at, note").eq("org_id", orgId).in("proposal_id", proposalIds).order("requested_at", { ascending: false }).limit(1000);
  if (error || !rows?.length) return new Map();
  const { data: versions } = await admin.from("proposal_final_versions").select("id, proposal_id, work_item_id, chosen_at").eq("org_id", orgId).in("proposal_id", proposalIds).order("chosen_at", { ascending: false }).limit(1000);
  const finals = new Map<string, { id: string; work_item_id: string }[]>();
  for (const version of (versions ?? []) as { id: string; proposal_id: string; work_item_id: string }[]) {
    finals.set(version.proposal_id, [...(finals.get(version.proposal_id) ?? []), { id: version.id, work_item_id: version.work_item_id }]);
  }
  const itemIds = [...new Set([...finals.values()].flat().map((entry) => entry.work_item_id))];
  const { data: items } = itemIds.length ? await admin.from("work_items").select("id, title, display_title").eq("org_id", orgId).in("id", itemIds) : { data: [] };
  const people = [...new Set((rows as ApprovalRow[]).flatMap((row) => [row.requested_by, row.decided_by]).filter((value): value is string => Boolean(value)))];
  const { data: names } = people.length ? await admin.from("profiles").select("id, display_name").eq("org_id", orgId).in("id", people) : { data: [] };
  return approvalViews(
    rows as ApprovalRow[],
    finals,
    new Map(((items ?? []) as { id: string; title: string; display_title: string | null }[]).map((item) => [item.id, item.display_title || item.title])),
    new Map(((names ?? []) as { id: string; display_name: string }[]).map((person) => [person.id, person.display_name])),
  );
}

export async function realApprovalStore(context: LeadContext, profileId: string | null): Promise<ApprovalStore> {
  const base = await realFinalStore(context, profileId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as Loose;
  return {
    ...base,
    async finalVersions(orgId, proposalId) {
      const { data, error } = await admin.from("proposal_final_versions").select("id, work_item_id, chosen_at").eq("org_id", orgId).eq("proposal_id", proposalId).order("chosen_at", { ascending: false }).limit(50);
      if (error) return ABSENT.has(error.code ?? "") ? "absent" : [];
      return ((data ?? []) as { id: string; work_item_id: string }[]).map((row) => ({ id: row.id, work_item_id: row.work_item_id }));
    },
    async approvalRows(orgId, proposalIds) {
      const { data, error } = await admin.from("proposal_approvals").select("id, proposal_id, final_version_id, requested_by, requested_at, decision, decided_by, decided_at, note").eq("org_id", orgId).in("proposal_id", proposalIds).order("requested_at", { ascending: false }).limit(200);
      if (error) return ABSENT.has(error.code ?? "") ? "absent" : [];
      return (data ?? []) as ApprovalRow[];
    },
    async insertApproval(row) {
      const { error } = await admin.from("proposal_approvals").insert(row);
      if (!error) return "ok";
      if (ABSENT.has(error.code ?? "")) return "absent";
      return error.code === "23505" ? "taken" : null;
    },
    async decide(id, orgId, patch) {
      const { data, error } = await admin.from("proposal_approvals").update(patch).eq("id", id).eq("org_id", orgId).is("decision", null).select("id");
      return !error && (data ?? []).length === 1;
    },
    async markSent(proposalId, orgId, at, by) {
      let result = await admin.from("proposals").update({ sent_at: at, sent_by: by }).eq("id", proposalId).eq("org_id", orgId).eq("status", "open").is("sent_at", null).select("id");
      // Before the sent_by column exists, the clock still stops.
      if (result.error && ["42703", "PGRST204"].includes(result.error.code ?? "")) {
        result = await admin.from("proposals").update({ sent_at: at }).eq("id", proposalId).eq("org_id", orgId).eq("status", "open").is("sent_at", null).select("id");
      }
      return !result.error && (result.data ?? []).length === 1;
    },
    async otherAdmins(orgId, except) {
      const { data } = await admin.from("profiles").select("id").eq("org_id", orgId).eq("role", "admin").eq("is_guest", false).is("deactivated_at", null).neq("id", except).limit(5);
      return (data ?? []).length;
    },
  };
}

export const approvalHandlers = {
  async ask(context: LeadContext, data: ApprovalAskInput): Promise<ApprovalResult> {
    return askApproval(await realApprovalStore(context, data.profile_id), data);
  },
  async decide(context: LeadContext, data: ApprovalDecideInput): Promise<ApprovalResult> {
    return decideApproval(await realApprovalStore(context, data.profile_id), data);
  },
  async final(context: LeadContext, data: ApprovalFinalInput) {
    return readFinalForApproval(await realApprovalStore(context, data.profile_id), data);
  },
};

export type { LeadProposalRow };
