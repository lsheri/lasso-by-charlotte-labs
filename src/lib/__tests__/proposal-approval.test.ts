// 21 Nov 2026, chat pill Phase 5 (D-97): the approval loop. Only admins approve; an admin who leads it cannot; one
// open request; a replaced version is refused; approving marks it as gone to the client; nothing is texted.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import type { LeadProposalRow } from "@/lib/lead-view.server";
import { askApproval, decideApproval, readFinalForApproval, type ApprovalStore } from "@/lib/proposal-approval.server";
import { APPROVAL_COPY, approvalDecideInput, approvalViews, mayDecide, proposalStage, type ApprovalRow } from "@/lib/proposal-approval-shared";

const ORG = "00000000-0000-4000-8000-0000000000a1";
const CHRISTY = "00000000-0000-4000-8000-0000000000c1";
const MAREN = "00000000-0000-4000-8000-0000000000c2";
const TOBI = "00000000-0000-4000-8000-0000000000c3";
const ROW_CHRISTY = "00000000-0000-4000-8000-0000000000d1";
const P1 = "00000000-0000-4000-8000-0000000000e1";
const V1 = "00000000-0000-4000-8000-0000000000b1";
const V2 = "00000000-0000-4000-8000-0000000000b2";
const A1 = "00000000-0000-4000-8000-0000000000f1";
const NOW = new Date("2026-11-21T12:00:00Z");

const proposal = (over: Partial<LeadProposalRow> = {}): LeadProposalRow => ({
  id: P1, org_id: ORG, client_id: "c", title: "Care model review", owner_id: MAREN, received_at: "2026-11-20T12:00:00Z", sent_at: null,
  status: "open", archived_at: null, lead_contact_id: ROW_CHRISTY, client_due_on: null, notes: null, ...over,
});
const open = (over: Partial<ApprovalRow> = {}): ApprovalRow => ({ id: A1, proposal_id: P1, final_version_id: V1, requested_by: CHRISTY, requested_at: "2026-11-21T10:00:00Z", decision: null, decided_by: null, decided_at: null, note: null, ...over });

function world(over: Partial<ApprovalStore> & { me?: string; role?: string; row?: LeadProposalRow; approvals?: ApprovalRow[]; versions?: { id: string; work_item_id: string | null }[]; others?: number } = {}) {
  const approvals = over.approvals ?? [];
  const writes: unknown[] = [];
  const events: unknown[] = [];
  const store = {
    caller: async () => ({ profileId: over.me ?? CHRISTY, orgId: ORG, role: over.role ?? "em", userId: "u" }),
    myContacts: async (_o: string, me: string) => (me === CHRISTY ? [ROW_CHRISTY] : []),
    proposal: async (id: string) => (id === P1 ? (over.row ?? proposal()) : null),
    personNames: async () => new Map([[CHRISTY, "Christy Johnson"]]),
    settings: async () => ({ proposal_goal_hours: 72 }),
    record: async (_c: unknown, type: string, dims: unknown) => void events.push({ type, dims }),
    now: () => NOW,
    item: async (_o: string, id: string) => ({ id, owner_id: CHRISTY, title: "Final v3" }),
    itemText: async () => "The final words. Fee 45,000.",
    finalVersions: async () => over.versions ?? [{ id: V1, work_item_id: "item-1" }],
    approvalRows: async () => approvals,
    insertApproval: async (row: unknown) => {
      writes.push({ insert: row });
      return "ok" as const;
    },
    decide: async (id: string, _o: string, patch: unknown) => {
      writes.push({ decide: id, patch });
      return true;
    },
    markSent: async (id: string, _o: string, at: string, by: string) => {
      writes.push({ sent: id, at, by });
      return true;
    },
    otherAdmins: async () => over.others ?? 1,
    ...over,
  } as unknown as ApprovalStore;
  return { store, writes, events };
}

describe("the pure rules", () => {
  it("where a proposal stands", () => {
    expect(proposalStage({ status: "open", sentAt: null, hasFinal: false, approval: null })).toBe("final_needed");
    expect(proposalStage({ status: "open", sentAt: null, hasFinal: true, approval: null })).toBe("ready_to_send");
    expect(proposalStage({ status: "open", sentAt: null, hasFinal: true, approval: { state: "waiting", stale: false } })).toBe("awaiting_approval");
    expect(proposalStage({ status: "open", sentAt: null, hasFinal: true, approval: { state: "changes_asked", stale: false } })).toBe("changes_asked");
    expect(proposalStage({ status: "open", sentAt: "2026-11-21T12:00:00Z", hasFinal: true, approval: { state: "approved", stale: false } })).toBe("client_review");
    expect(proposalStage({ status: "won", sentAt: null, hasFinal: true, approval: null })).toBe("decided");
  });
  it("only an admin who does not lead it decides", () => {
    expect(mayDecide("admin", false)).toBe(true);
    expect(mayDecide("admin", true)).toBe(false);
    for (const role of ["lead", "em", "coach", null]) expect(mayDecide(role, false)).toBe(false);
  });
  it("a note is tidied and capped; a bad decision is refused", () => {
    expect(approvalDecideInput({ proposal_id: P1, approval_id: A1, decision: "changes_asked", note: "  tighten   scope " }).note).toBe("tighten scope");
    expect(approvalDecideInput({ proposal_id: P1, approval_id: A1, decision: "changes_asked", note: "x".repeat(2000) }).note).toHaveLength(1000);
    expect(() => approvalDecideInput({ proposal_id: P1, approval_id: A1, decision: "rubber-stamp" })).toThrow();
  });
  it("views: the latest request per proposal, stale when a newer final was chosen", () => {
    const views = approvalViews([open({ requested_at: "2026-11-20T00:00:00Z", id: "old", decision: "changes_asked", decided_at: "x" }), open()], new Map([[P1, [{ id: V2, work_item_id: "i2" }, { id: V1, work_item_id: "i1" }]]]), new Map([["i1", "Final v1"]]), new Map([[CHRISTY, "Christy"]]));
    expect(views.get(P1)).toMatchObject({ id: A1, state: "waiting", requestedBy: "Christy", finalTitle: "Final v1", stale: true });
  });
});

describe("sending for approval", () => {
  it("the lead sends the latest final: one request, one event", async () => {
    const { store, writes, events } = world();
    expect(await askApproval(store, { profile_id: null, proposal_id: P1, withdraw: false })).toEqual({ ok: true });
    expect(writes).toEqual([{ insert: { org_id: ORG, proposal_id: P1, final_version_id: V1, requested_by: CHRISTY, requested_at: NOW.toISOString() } }]);
    expect(events).toEqual([{ type: "proposal.approval_requested", dims: {} }]);
  });
  it("one open request per proposal; no final, or a deleted one, cannot be sent", async () => {
    expect(await askApproval(world({ approvals: [open()] }).store, { profile_id: null, proposal_id: P1, withdraw: false })).toEqual({ ok: false, problem: APPROVAL_COPY.already });
    expect(await askApproval(world({ versions: [] }).store, { profile_id: null, proposal_id: P1, withdraw: false })).toEqual({ ok: false, problem: APPROVAL_COPY.needsFinal });
    expect(await askApproval(world({ versions: [{ id: V1, work_item_id: null }] }).store, { profile_id: null, proposal_id: P1, withdraw: false })).toEqual({ ok: false, problem: APPROVAL_COPY.needsFinal });
    expect(await askApproval(world({ insertApproval: async () => "taken" }).store, { profile_id: null, proposal_id: P1, withdraw: false })).toEqual({ ok: false, problem: APPROVAL_COPY.already });
  });
  it("someone who neither leads nor started it, or a closed proposal, is refused", async () => {
    expect(await askApproval(world({ me: TOBI }).store, { profile_id: null, proposal_id: P1, withdraw: false })).toEqual({ ok: false, problem: APPROVAL_COPY.notLead });
    expect(await askApproval(world({ row: proposal({ status: "lost" }) }).store, { profile_id: null, proposal_id: P1, withdraw: false })).toEqual({ ok: false, problem: APPROVAL_COPY.closed });
  });
  it("taking it back withdraws the open request", async () => {
    const { store, writes, events } = world({ approvals: [open()] });
    expect(await askApproval(store, { profile_id: null, proposal_id: P1, withdraw: true })).toEqual({ ok: true });
    expect(writes).toEqual([{ decide: A1, patch: { decision: "withdrawn", decided_by: CHRISTY, decided_at: NOW.toISOString(), note: null } }]);
    expect(events).toEqual([{ type: "proposal.approval_decided", dims: { decision: "withdrawn" } }]);
  });
  it("before the SQL it says not ready", async () => {
    expect(await askApproval(world({ approvalRows: async () => "absent" }).store, { profile_id: null, proposal_id: P1, withdraw: false })).toEqual({ ok: false, problem: APPROVAL_COPY.notReady });
  });
});

describe("deciding", () => {
  const decide = (over: Partial<Parameters<typeof decideApproval>[1]> = {}) => ({ profile_id: null, proposal_id: P1, approval_id: A1, decision: "approved" as const, note: null, ...over });

  it("an admin approves: the request is decided, the proposal goes to the client with who did it, within-goal is counted", async () => {
    const { store, writes, events } = world({ me: MAREN, role: "admin", approvals: [open()] });
    expect(await decideApproval(store, decide())).toEqual({ ok: true });
    expect(writes).toEqual([
      { decide: A1, patch: { decision: "approved", decided_by: MAREN, decided_at: NOW.toISOString(), note: null } },
      { sent: P1, at: NOW.toISOString(), by: MAREN },
    ]);
    expect(events).toEqual([
      { type: "proposal.approval_decided", dims: { decision: "approved" } },
      { type: "proposal.client_review", dims: { within_goal: "yes" } },
    ]);
  });
  it("asking for changes keeps the note and sends nothing to the client", async () => {
    const { store, writes } = world({ me: MAREN, role: "admin", approvals: [open()] });
    expect(await decideApproval(store, decide({ decision: "changes_asked", note: "Tighten the scope" }))).toEqual({ ok: true });
    expect(writes).toEqual([{ decide: A1, patch: { decision: "changes_asked", decided_by: MAREN, decided_at: NOW.toISOString(), note: "Tighten the scope" } }]);
  });
  it("only admins: a Lead, a Member or a coach is refused before anything is read", async () => {
    for (const role of ["lead", "em", "coach"]) {
      const proposalRead = vi.fn(async () => proposal());
      const { store, writes } = world({ me: MAREN, role, approvals: [open()], proposal: proposalRead });
      expect(await decideApproval(store, decide())).toEqual({ ok: false, problem: APPROVAL_COPY.adminsOnly });
      expect(proposalRead).not.toHaveBeenCalled();
      expect(writes).toEqual([]);
    }
  });
  it("an admin who leads it cannot approve their own; with no other admin, the app says so", async () => {
    const own = world({ me: CHRISTY, role: "admin", approvals: [open()] });
    expect(await decideApproval(own.store, decide())).toEqual({ ok: false, problem: APPROVAL_COPY.ownRequest });
    const alone = world({ me: CHRISTY, role: "admin", approvals: [open()], others: 0 });
    expect(await decideApproval(alone.store, decide())).toEqual({ ok: false, problem: APPROVAL_COPY.onlyAdmin });
    expect(own.writes).toEqual([]);
  });
  it("a replaced version, a deleted final, a request no longer open, a lost or won proposal are all refused", async () => {
    const admin = { me: MAREN, role: "admin" };
    expect(await decideApproval(world({ ...admin, approvals: [open()], versions: [{ id: V2, work_item_id: "i2" }, { id: V1, work_item_id: "i1" }] }).store, decide())).toEqual({ ok: false, problem: APPROVAL_COPY.stale("Christy Johnson") });
    expect(await decideApproval(world({ ...admin, approvals: [open()], versions: [{ id: V1, work_item_id: null }] }).store, decide())).toEqual({ ok: false, problem: APPROVAL_COPY.finalGone });
    expect(await decideApproval(world({ ...admin, approvals: [] }).store, decide())).toEqual({ ok: false, problem: APPROVAL_COPY.gone });
    expect(await decideApproval(world({ ...admin, approvals: [open()], decide: async () => false }).store, decide())).toEqual({ ok: false, problem: APPROVAL_COPY.gone });
    for (const status of ["lost", "won"]) expect(await decideApproval(world({ ...admin, approvals: [open()], row: proposal({ status }) }).store, decide())).toEqual({ ok: false, problem: APPROVAL_COPY.closed });
  });
  it("approving a proposal already marked sent keeps its sent date", async () => {
    const { store, writes } = world({ me: MAREN, role: "admin", approvals: [open()], row: proposal({ sent_at: "2026-11-21T09:00:00Z" }) });
    await decideApproval(store, decide());
    expect(writes).toHaveLength(1);
  });
});

describe("reading the final to approve", () => {
  it("an admin reads it while a request is open; nobody else does", async () => {
    expect(await readFinalForApproval(world({ me: MAREN, role: "admin", approvals: [open()] }).store, { profile_id: null, proposal_id: P1 })).toEqual({ ok: true, title: "Final v3", text: "The final words. Fee 45,000." });
    expect(await readFinalForApproval(world({ me: CHRISTY, role: "lead", approvals: [open()] }).store, { profile_id: null, proposal_id: P1 })).toEqual({ ok: false, problem: APPROVAL_COPY.adminsOnly });
    expect(await readFinalForApproval(world({ me: MAREN, role: "admin", approvals: [] }).store, { profile_id: null, proposal_id: P1 })).toEqual({ ok: false, problem: APPROVAL_COPY.gone });
  });
});

describe("the floors, read from the source", () => {
  it("nothing is texted, every function signs in, and the SQL is server only with one open request per proposal", () => {
    const server = readFileSync("src/lib/proposal-approval.server.ts", "utf8");
    expect(server).not.toMatch(/text-sender|sendText|bird/i);
    const fns = readFileSync("src/lib/proposal-approval.functions.ts", "utf8");
    expect(fns.match(/\.middleware\(\[requireSupabaseAuth\]\)/g)).toHaveLength(3);
    const sql = readFileSync("supabase/migrations/20261121050000_proposal_approvals.sql", "utf8");
    expect(sql).toMatch(/create unique index if not exists proposal_approvals_one_open[\s\S]*where decision is null/);
    expect(sql).toMatch(/revoke all on table public\.proposal_approvals from public, anon, authenticated/);
    expect(sql).not.toMatch(/create policy|grant [^;]* to (anon|authenticated)/i);
    expect(readFileSync("supabase/undo/20261121050000_proposal_approvals_undo.sql", "utf8")).toContain("drop table if exists public.proposal_approvals");
  });
});
