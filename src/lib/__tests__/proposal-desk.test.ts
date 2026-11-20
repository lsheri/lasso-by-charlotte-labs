import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { navFor } from "@/components/layout/nav-config";
import { DEFAULT_VOCAB } from "@/lib/edu-vocab";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
import { settingsChangedDims } from "@/lib/settings-events";
import {
  checkNewProposal,
  countBand,
  DEFAULT_GOAL_HOURS,
  deskCounts,
  deskDate,
  deskView,
  goalChoices,
  goalHours,
  goalLabel,
  goalToSave,
  SENT_COPY,
  sentInput,
  WIN_COPY,
  winInput,
  INTAKE_COPY,
  newProposalInput,
  sameClientName,
  timeLeft,
  timeLeftLine,
  type DeskProposal,
  LEAD_COPY,
  leadInput,
} from "@/lib/proposal-desk-shared";
import { createProposal, listDesk, listDeskClients, setProposalLead, setProposalSent, winProposal, type DeskCaller, type DeskStore, type ProposalRow } from "@/lib/proposal-desk.server";

const ORG = "11111111-1111-4111-8111-111111111111";
const ME = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const CLIENT = "44444444-4444-4444-8444-444444444444";
const ITEM_A = "55555555-5555-4555-8555-555555555555";
const ITEM_B = "66666666-6666-4666-8666-666666666666";
const LEAD = "77777777-7777-4777-8777-777777777777";
const STRANGER = "88888888-8888-4888-8888-888888888888";
const NOW = new Date("2026-11-20T12:00:00Z");
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();

const proposal = (over: Partial<DeskProposal>): DeskProposal => ({
  id: "p", title: "Network redesign", clientName: "Marrowfield", ownerName: "Maren", mine: false, status: "open",
  receivedAt: hoursAgo(10), sentAt: null, decidedAt: null, engagementId: null, contextCount: 0, canAct: false, ...over,
});

describe("the turnaround goal", () => {
  it("is 72 hours until a workspace picks its own, and never zero or junk", () => {
    expect(DEFAULT_GOAL_HOURS).toBe(72);
    for (const settings of [null, undefined, {}, "x", { proposal_goal_hours: 0 }, { proposal_goal_hours: -4 }, { proposal_goal_hours: "48" }, { proposal_goal_hours: 1.5 }, { proposal_goal_hours: 721 }]) {
      expect(goalHours(settings)).toBe(72);
    }
    expect(goalHours({ proposal_goal_hours: 48 })).toBe(48);
    expect(goalHours({ proposal_goal_hours: 1 })).toBe(1);
    expect(goalHours({ proposal_goal_hours: 720 })).toBe(720);
  });

  it("counts time left, time over and time taken against the workspace's goal", () => {
    expect(timeLeft({ receivedAt: hoursAgo(10), sentAt: null, goalHours: 72, now: NOW })).toEqual({ state: "running", hoursLeft: 62 });
    expect(timeLeft({ receivedAt: hoursAgo(10), sentAt: null, goalHours: 24, now: NOW })).toEqual({ state: "running", hoursLeft: 14 });
    expect(timeLeft({ receivedAt: hoursAgo(72), sentAt: null, goalHours: 72, now: NOW })).toEqual({ state: "running", hoursLeft: 0 });
    expect(timeLeft({ receivedAt: hoursAgo(75.5), sentAt: null, goalHours: 72, now: NOW })).toEqual({ state: "over", hoursOver: 4 });
    expect(timeLeft({ receivedAt: hoursAgo(30), sentAt: hoursAgo(10), goalHours: 72, now: NOW })).toEqual({ state: "sent", hoursTaken: 20, withinGoal: true });
    expect(timeLeft({ receivedAt: hoursAgo(100), sentAt: hoursAgo(10), goalHours: 72, now: NOW })).toEqual({ state: "sent", hoursTaken: 90, withinGoal: false });
  });

  it("treats an unreadable or future date as now, so nothing shows as years late", () => {
    expect(timeLeft({ receivedAt: "nonsense", sentAt: null, goalHours: 72, now: NOW })).toEqual({ state: "running", hoursLeft: 72 });
    expect(timeLeft({ receivedAt: new Date(NOW.getTime() + 9e8).toISOString(), sentAt: null, goalHours: 72, now: NOW })).toEqual({ state: "running", hoursLeft: 72 });
  });

  it("says it in one plain line that names the goal, never a hard-coded 72", () => {
    expect(timeLeftLine({ state: "running", hoursLeft: 14 }, 24)).toBe("14 hours left of 24");
    expect(timeLeftLine({ state: "running", hoursLeft: 1 }, 72)).toBe("1 hour left of 72");
    expect(timeLeftLine({ state: "running", hoursLeft: 0 }, 72)).toBe("Less than an hour left of 72");
    expect(timeLeftLine({ state: "over", hoursOver: 4 }, 48)).toBe("Over the 48 hour goal by 4 hours");
    expect(timeLeftLine({ state: "sent", hoursTaken: 20, withinGoal: true }, 72)).toBe("Went out in 20 hours");
    expect(timeLeftLine({ state: "sent", hoursTaken: 90, withinGoal: false }, 72)).toBe("Went out in 90 hours, over the 72 hour goal");
  });
});

describe("the three views", () => {
  const rows = [
    proposal({ id: "a", receivedAt: hoursAgo(5) }),
    proposal({ id: "b", receivedAt: hoursAgo(50), mine: true }),
    proposal({ id: "c", receivedAt: hoursAgo(90), sentAt: hoursAgo(80) }),
    proposal({ id: "d", status: "won", decidedAt: hoursAgo(2), engagementId: "e1" }),
    proposal({ id: "e", status: "won", decidedAt: hoursAgo(1), mine: true }),
    proposal({ id: "f", status: "lost", decidedAt: hoursAgo(3) }),
  ];

  it("puts the oldest brief still to go out first, and proposals already out last", () => {
    expect(deskView(rows, "open").map((p) => p.id)).toEqual(["b", "a", "c"]);
    expect(deskView(rows, "mine").map((p) => p.id)).toEqual(["b"]);
    expect(deskView(rows, "won").map((p) => p.id)).toEqual(["e", "d"]);
    expect(deskCounts(rows)).toEqual({ open: 3, mine: 1, won: 2 });
  });

  it("handles none at all, and does not reorder the list it was given", () => {
    expect(deskCounts([])).toEqual({ open: 0, mine: 0, won: 0 });
    const before = rows.map((p) => p.id);
    deskView(rows, "open");
    expect(rows.map((p) => p.id)).toEqual(before);
  });

  it("writes dates the same everywhere", () => {
    expect(deskDate("2026-11-20T09:00:00Z")).toBe("Fri 20 Nov");
    expect(deskDate(null)).toBe("");
    expect(deskDate("junk")).toBe("");
  });
});

describe("what a person may type", () => {
  const ok = { profile_id: ME, title: "  Network   redesign ", client_id: CLIENT, notes: " call notes ", work_item_ids: [ITEM_A, ITEM_A, ITEM_B] };

  it("tidies a good proposal", () => {
    expect(checkNewProposal(ok)).toEqual({ ok: true, input: { profile_id: ME, title: "Network redesign", client_id: CLIENT, new_client_name: null, notes: "call notes", work_item_ids: [ITEM_A, ITEM_B] } });
    expect(checkNewProposal({ title: "x", new_client_name: " St. Brigid's  Hospital " })).toMatchObject({ ok: true, input: { client_id: null, new_client_name: "St. Brigid's Hospital", notes: null, work_item_ids: [] } });
  });

  it("names each problem", () => {
    const problem = (raw: unknown) => { const r = checkNewProposal(raw as never); return r.ok ? null : r.problem; };
    expect(problem({ ...ok, title: "   " })).toBe("title");
    expect(problem({ ...ok, title: "x".repeat(161) })).toBe("titleLong");
    expect(problem({ title: "x" })).toBe("client");
    expect(problem({ title: "x", client_id: "not-an-id" })).toBe("client");
    expect(problem({ title: "x", new_client_name: "  " })).toBe("clientName");
    expect(problem({ title: "x", client_id: CLIENT, new_client_name: "Both" })).toBe("client");
    expect(problem({ title: "x", new_client_name: "n".repeat(121) })).toBe("clientLong");
    expect(problem({ ...ok, notes: "n".repeat(8001) })).toBe("notesLong");
    expect(problem({ ...ok, work_item_ids: [ITEM_A, "junk"] })).toBe("notYours");
    expect(problem({ ...ok, work_item_ids: Array.from({ length: 21 }, (_, i) => `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`) })).toBe("tooMany");
    expect(problem(null)).toBe("title");
    expect(() => newProposalInput({ title: "" })).toThrow(INTAKE_COPY.problems.title);
  });

  it("matches client names loosely and bands counts", () => {
    expect(sameClientName(" marrowfield  group", "Marrowfield Group")).toBe(true);
    expect(sameClientName("Marrowfield", "Marrowfield Group")).toBe(false);
    expect([0, 1, 2, 5, 6, 40].map(countBand)).toEqual(["0", "1", "2-5", "2-5", "6+", "6+"]);
  });
});

/* ------------------------------------------------------------------------- */

type Fake = DeskStore & { state: { proposals: Record<string, unknown>[]; context: Record<string, unknown>[]; clients: { id: string; name: string }[]; events: Record<string, string>[]; removedClients: string[]; sent: { id: string; sentAt: string | null }[]; steps: string[]; boards: Record<string, unknown>[]; placed: { taskId: string; ids: string[] }[]; ledger: { kind: string; occurred_at: string }[]; claims: { id: string; engagementId: string }[]; removedBoards: string[]; leads: { id: string; contactId: string | null }[] } };

function fakeStore(over: Partial<DeskStore> & { role?: string; rows?: ProposalRow[]; owned?: string[] } = {}): Fake {
  const caller: DeskCaller = { profileId: ME, orgId: ORG, role: over.role ?? "manager", userId: "u" };
  const state: Fake["state"] = { proposals: [], context: [], clients: [{ id: CLIENT, name: "Marrowfield" }], events: [], removedClients: [], sent: [], steps: [], boards: [], placed: [], ledger: [], claims: [], removedBoards: [], leads: [] };
  let next = 0;
  return {
    state,
    caller: async () => caller,
    settings: async () => ({ proposal_goal_hours: 48 }),
    proposals: async () => over.rows ?? [],
    clientNames: async () => new Map([[CLIENT, "Marrowfield"]]),
    ownerNames: async () => new Map([[ME, "Harper"], [OTHER, "Maren"]]),
    context: async () => [{ proposal_id: "p1", work_item_id: ITEM_A }, { proposal_id: "p2", work_item_id: ITEM_B }],
    itemTitles: async (ids) => new Map(ids.map((id) => [id, id === ITEM_A ? "Call notes" : "SECRET other person's file"])),
    clients: async () => [...state.clients],
    createClient: async (_org, name) => { state.clients.push({ id: "new-client", name }); return "new-client"; },
    removeClient: async (id) => { state.removedClients.push(id); },
    ownedItems: async (_o, _p, ids) => ids.filter((id) => (over.owned ?? [ITEM_A, ITEM_B]).includes(id)),
    insertProposal: async (row) => { state.proposals.push(row); return true; },
    insertContext: async (rows) => { state.context.push(...rows); return true; },
    removeProposal: async (id) => { state.proposals = state.proposals.filter((p) => p["id"] !== id); },
    proposal: async (id) => (over.rows ?? []).find((r) => r.id === id) ?? null,
    setSent: async (id, sentAt) => { state.sent.push({ id, sentAt }); return true; },
    rosterHas: async (orgId, contactId) => orgId === ORG && contactId === LEAD,
    setLead: async (id, contactId) => { state.leads.push({ id, contactId }); return true; },
    notes: async () => "  Met them at the conference.  ",
    makeBoard: async (board) => { state.steps.push("board"); state.boards.push(board); return true; },
    boardHome: async () => { state.steps.push("home"); return "task-1"; },
    placeItems: async (taskId, ids) => { state.steps.push("place"); state.placed.push({ taskId, ids }); return true; },
    writeLedger: async (rows) => { state.steps.push("ledger"); state.ledger.push(...rows.map((r) => ({ kind: r.kind, occurred_at: r.occurred_at }))); return true; },
    claimWin: async (id, engagementId) => { state.steps.push("claim"); state.claims.push({ id, engagementId }); return true; },
    removeBoard: async (id) => { state.removedBoards.push(id); },
    now: () => NOW,
    record: async (_c, e, dims) => { state.events.push(e === "proposal.created" ? dims : { event: e, ...dims }); },
    newId: () => `id-${++next}`,
    ...over,
  };
}

const row = (over: Partial<ProposalRow>): ProposalRow => ({ id: "p1", org_id: ORG, client_id: CLIENT, title: "Network redesign", owner_id: ME, received_at: hoursAgo(5), sent_at: null, status: "open", decided_at: null, engagement_id: null, ...over });

describe("the dashboard read", () => {
  const rows = [row({}), row({ id: "p2", owner_id: OTHER }), row({ id: "p3", org_id: "another-org", owner_id: OTHER }), row({ id: "p4", status: "weird" })];

  it("shows a member only their own, with their own document titles", async () => {
    const list = await listDesk(fakeStore({ rows }));
    expect(list.proposals.map((p) => p.id)).toEqual(["p1"]);
    expect(list.proposals[0]).toMatchObject({ mine: true, canAct: true, clientName: "Marrowfield", ownerName: "Harper", contextCount: 1, contextTitles: ["Call notes"] });
    expect(list.goalHours).toBe(48);
    expect(list.canSetGoal).toBe(false);
  });

  it("shows admins and leads the workspace's proposals, a count for others' documents and never their titles", async () => {
    for (const role of ["admin", "lead"]) {
      const list = await listDesk(fakeStore({ rows, role }));
      expect(list.proposals.map((p) => p.id)).toEqual(["p1", "p2"]);
      const theirs = list.proposals.find((p) => p.id === "p2");
      expect(theirs).toMatchObject({ mine: false, canAct: true, ownerName: "Maren", contextCount: 1 });
      expect(theirs && "contextTitles" in theirs).toBe(false);
      expect(JSON.stringify(list)).not.toContain("SECRET");
      expect(list.canSetGoal).toBe(role === "admin");
    }
  });

  it("fails loudly when the read fails, and refuses whoever the caller check refuses", async () => {
    await expect(listDesk(fakeStore({ proposals: async () => null }))).rejects.toThrow();
    const refused = fakeStore({ caller: async () => { throw new Response("Forbidden", { status: 403 }); } });
    await expect(listDesk(refused)).rejects.toBeInstanceOf(Response);
    await expect(listDeskClients(refused)).rejects.toBeInstanceOf(Response);
    await expect(createProposal(refused, newProposalInput({ title: "x", client_id: CLIENT }))).rejects.toBeInstanceOf(Response);
    expect(refused.state.proposals).toEqual([]);
  });
});

describe("starting a proposal", () => {
  it("makes a row for an existing client, with the documents in order, and no board", async () => {
    const store = fakeStore();
    const result = await createProposal(store, newProposalInput({ title: "Network redesign", client_id: CLIENT, notes: "call notes", work_item_ids: [ITEM_B, ITEM_A] }));
    expect(result).toEqual({ ok: true, id: "id-1" });
    expect(store.state.proposals).toEqual([{ id: "id-1", org_id: ORG, client_id: CLIENT, title: "Network redesign", notes: "call notes", owner_id: ME }]);
    expect(store.state.context).toEqual([{ proposal_id: "id-1", work_item_id: ITEM_B, position: 0 }, { proposal_id: "id-1", work_item_id: ITEM_A, position: 1 }]);
    expect(store.state.events).toEqual([{ client: "existing", documents: "2-5", notes: "yes" }]);
    expect(JSON.stringify(store.state.proposals)).not.toContain("engagement");
  });

  it("adds a new client, and reuses one that is already there under the same name", async () => {
    const fresh = fakeStore();
    expect(await createProposal(fresh, newProposalInput({ title: "Audit", new_client_name: "Quillbrook" }))).toMatchObject({ ok: true });
    expect(fresh.state.proposals[0]).toMatchObject({ client_id: "new-client" });
    expect(fresh.state.events[0]).toEqual({ client: "new", documents: "0", notes: "no" });

    const same = fakeStore({ createClient: vi.fn(async () => "should-not-be-made") });
    expect(await createProposal(same, newProposalInput({ title: "Audit", new_client_name: "  marrowfield " }))).toMatchObject({ ok: true });
    expect(same.createClient).not.toHaveBeenCalled();
    expect(same.state.proposals[0]).toMatchObject({ client_id: CLIENT });
  });

  it("refuses a document that is not the person's own, before writing anything", async () => {
    const store = fakeStore({ owned: [ITEM_A] });
    expect(await createProposal(store, newProposalInput({ title: "x", client_id: CLIENT, work_item_ids: [ITEM_A, ITEM_B] }))).toEqual({ ok: false, problem: INTAKE_COPY.problems.notYours });
    expect(store.state.proposals).toEqual([]);
    expect(store.state.events).toEqual([]);
  });

  it("refuses a client from elsewhere, an archived client, and a refused new client", async () => {
    expect(await createProposal(fakeStore(), newProposalInput({ title: "x", client_id: OTHER }))).toEqual({ ok: false, problem: INTAKE_COPY.problems.clientGone });
    const refused = fakeStore({ createClient: async () => null });
    expect(await createProposal(refused, newProposalInput({ title: "x", new_client_name: "Tarnhollow" }))).toEqual({ ok: false, problem: INTAKE_COPY.problems.failed });
    expect(refused.state.proposals).toEqual([]);
  });

  it("leaves nothing behind when a write fails part way", async () => {
    const noRow = fakeStore({ insertProposal: async () => false });
    expect(await createProposal(noRow, newProposalInput({ title: "x", new_client_name: "Tarnhollow" }))).toMatchObject({ ok: false });
    expect(noRow.state.removedClients).toEqual(["new-client"]);

    const noDocs = fakeStore({ insertContext: async () => false });
    expect(await createProposal(noDocs, newProposalInput({ title: "x", new_client_name: "Tarnhollow", work_item_ids: [ITEM_A] }))).toMatchObject({ ok: false });
    expect(noDocs.state.proposals).toEqual([]);
    expect(noDocs.state.removedClients).toEqual(["new-client"]);
    expect(noDocs.state.events).toEqual([]);

    const keepClient = fakeStore({ insertContext: async () => false });
    await createProposal(keepClient, newProposalInput({ title: "x", client_id: CLIENT, work_item_ids: [ITEM_A] }));
    expect(keepClient.state.removedClients).toEqual([]);
  });

  it("keeps the proposal when only the recording fails", async () => {
    const store = fakeStore({ record: async () => { throw new Error("down"); } });
    expect(await createProposal(store, newProposalInput({ title: "x", client_id: CLIENT }))).toMatchObject({ ok: true });
    expect(store.state.proposals).toHaveLength(1);
  });
});

describe("marking a proposal as sent", () => {
  const rows = [row({ received_at: hoursAgo(20) }), row({ id: "p2", owner_id: OTHER, received_at: hoursAgo(100) }), row({ id: "p3", org_id: "another-org", owner_id: OTHER }), row({ id: "p5", status: "won", decided_at: hoursAgo(1) }), row({ id: "p6", sent_at: hoursAgo(2) })];
  const P = (id: string, sent: boolean) => sentInput({ profile_id: ME, proposal_id: id, sent });
  const UUIDS: Record<string, string> = { p1: "aaaaaaaa-0000-4000-8000-000000000001", p2: "aaaaaaaa-0000-4000-8000-000000000002", p3: "aaaaaaaa-0000-4000-8000-000000000003", p5: "aaaaaaaa-0000-4000-8000-000000000005", p6: "aaaaaaaa-0000-4000-8000-000000000006" };
  const real = rows.map((r) => ({ ...r, id: UUIDS[r.id]! }));

  it("lets the owner stop the clock, and records whether it was inside the goal", async () => {
    const store = fakeStore({ rows: real });
    expect(await setProposalSent(store, P(UUIDS["p1"]!, true))).toEqual({ ok: true });
    expect(store.state.sent).toEqual([{ id: UUIDS["p1"], sentAt: NOW.toISOString() }]);
    expect(store.state.events).toEqual([{ event: "proposal.sent", change: "sent", within_goal: "yes" }]);
  });

  it("lets an admin or lead do it for someone else, and says when it went out late", async () => {
    const store = fakeStore({ rows: real, role: "lead" });
    expect(await setProposalSent(store, P(UUIDS["p2"]!, true))).toEqual({ ok: true });
    expect(store.state.events[0]).toMatchObject({ within_goal: "no" });
  });

  it("refuses someone else's proposal, another workspace's and a made-up id with the same words", async () => {
    const store = fakeStore({ rows: real });
    for (const id of [UUIDS["p2"]!, UUIDS["p3"]!, "aaaaaaaa-0000-4000-8000-00000000ffff"]) {
      expect(await setProposalSent(store, P(id, true))).toEqual({ ok: false, problem: SENT_COPY.notYours });
    }
    const admin = fakeStore({ rows: real, role: "admin" });
    expect(await setProposalSent(admin, P(UUIDS["p3"]!, true))).toEqual({ ok: false, problem: SENT_COPY.notYours });
    expect(store.state.sent).toEqual([]);
    expect(admin.state.sent).toEqual([]);
  });

  it("leaves a decided proposal alone, does nothing on a repeat, and can be taken back", async () => {
    const store = fakeStore({ rows: real });
    expect(await setProposalSent(store, P(UUIDS["p5"]!, true))).toEqual({ ok: false, problem: SENT_COPY.closed });
    expect(await setProposalSent(store, P(UUIDS["p6"]!, true))).toEqual({ ok: true });
    expect(store.state.sent).toEqual([]);
    expect(await setProposalSent(store, P(UUIDS["p6"]!, false))).toEqual({ ok: true });
    expect(store.state.sent).toEqual([{ id: UUIDS["p6"], sentAt: null }]);
    expect(store.state.events).toEqual([{ event: "proposal.sent", change: "unsent", within_goal: "na" }]);
  });

  it("says so when the write fails, and refuses an id that is not an id", async () => {
    const store = fakeStore({ rows: real, setSent: async () => false });
    expect(await setProposalSent(store, P(UUIDS["p1"]!, true))).toEqual({ ok: false, problem: SENT_COPY.failed });
    expect(store.state.events).toEqual([]);
    expect(() => sentInput({ proposal_id: "x", sent: true })).toThrow();
  });
});

describe("picking the lead", () => {
  const P1 = "aaaaaaaa-0000-4000-8000-000000000001";
  const rows = [row({ id: P1, owner_id: OTHER }), row({ id: "aaaaaaaa-0000-4000-8000-000000000002", org_id: "another-org" }), row({ id: "aaaaaaaa-0000-4000-8000-000000000003", status: "won", decided_at: hoursAgo(1) }), row({ id: "aaaaaaaa-0000-4000-8000-000000000004", lead_contact_id: LEAD })];
  const pick = (id: string, contact: string | null) => leadInput({ profile_id: ME, proposal_id: id, lead_contact_id: contact });

  it("lets an admin or a lead pick someone from the workspace's own list, and records only that a pick was made", async () => {
    for (const role of ["admin", "lead"]) {
      const store = fakeStore({ rows, role });
      expect(await setProposalLead(store, pick(P1, LEAD))).toEqual({ ok: true });
      expect(store.state.leads).toEqual([{ id: P1, contactId: LEAD }]);
      expect(store.state.events).toEqual([{ event: "proposal.lead_set", change: "set" }]);
      expect(JSON.stringify(store.state.events)).not.toContain(LEAD);
    }
  });

  it("refuses everyone else, even on their own proposal, and writes nothing", async () => {
    for (const role of ["manager", "em", "analyst", "coach"]) {
      const store = fakeStore({ rows: [row({ id: P1 })], role });
      expect(await setProposalLead(store, pick(P1, LEAD))).toEqual({ ok: false, problem: LEAD_COPY.notAllowed });
      expect(store.state.leads).toEqual([]);
    }
  });

  it("refuses another workspace's proposal, a decided one, a missing one and a person not on the list", async () => {
    const store = fakeStore({ rows, role: "admin" });
    expect(await setProposalLead(store, pick(rows[1]!.id, LEAD))).toEqual({ ok: false, problem: LEAD_COPY.notAllowed });
    expect(await setProposalLead(store, pick("aaaaaaaa-0000-4000-8000-00000000ffff", LEAD))).toEqual({ ok: false, problem: LEAD_COPY.notAllowed });
    expect(await setProposalLead(store, pick(rows[2]!.id, LEAD))).toEqual({ ok: false, problem: LEAD_COPY.closed });
    expect(await setProposalLead(store, pick(P1, STRANGER))).toEqual({ ok: false, problem: LEAD_COPY.missing });
    expect(store.state.leads).toEqual([]);
    expect(store.state.events).toEqual([]);
  });

  it("clears a lead, does nothing when nothing changes, and says so when the write fails", async () => {
    const store = fakeStore({ rows, role: "lead" });
    expect(await setProposalLead(store, pick(rows[3]!.id, null))).toEqual({ ok: true });
    expect(store.state.leads).toEqual([{ id: rows[3]!.id, contactId: null }]);
    expect(store.state.events).toEqual([{ event: "proposal.lead_set", change: "cleared" }]);
    expect(await setProposalLead(store, pick(rows[3]!.id, LEAD))).toEqual({ ok: true });
    expect(await setProposalLead(store, pick(P1, null))).toEqual({ ok: true });
    expect(store.state.leads).toHaveLength(1);
    const broken = fakeStore({ rows, role: "admin", setLead: async () => false });
    expect(await setProposalLead(broken, pick(P1, LEAD))).toEqual({ ok: false, problem: LEAD_COPY.failed });
    expect(broken.state.events).toEqual([]);
    const quiet = fakeStore({ rows, role: "admin", record: async () => { throw new Error("down"); } });
    expect(await setProposalLead(quiet, pick(P1, LEAD))).toEqual({ ok: true });
  });

  it("reads the input strictly: junk is refused, never read as a clear", () => {
    expect(() => leadInput({ proposal_id: "nope", lead_contact_id: LEAD })).toThrow(LEAD_COPY.failed);
    expect(() => leadInput({ proposal_id: P1, lead_contact_id: "nope" })).toThrow(LEAD_COPY.failed);
    expect(() => leadInput({ proposal_id: P1, lead_contact_id: undefined as never })).toThrow(LEAD_COPY.failed);
    expect(leadInput({ proposal_id: P1, lead_contact_id: null })).toEqual({ profile_id: null, proposal_id: P1, lead_contact_id: null });
  });

  it("tells only admins and leads who the lead is", async () => {
    const mine = [row({ lead_contact_id: LEAD })];
    const member = await listDesk(fakeStore({ rows: mine }));
    expect(member.canPickLead).toBe(false);
    expect(JSON.stringify(member)).not.toContain(LEAD);
    for (const role of ["admin", "lead"]) {
      const list = await listDesk(fakeStore({ rows: [...mine, row({ id: "p2", owner_id: OTHER })], role }));
      expect(list.canPickLead).toBe(true);
      expect(list.proposals.map((p) => p.leadContactId)).toEqual([LEAD, null]);
    }
    expect(EVENT_DIM_KEYS["proposal.lead_set"]).toEqual(["change"]);
  });
});

describe("recording the win", () => {
  const W1 = "bbbbbbbb-0000-4000-8000-000000000001";
  const W = (id = W1) => winInput({ profile_id: ME, proposal_id: id });
  const ctx = async () => [{ proposal_id: W1, work_item_id: ITEM_B }, { proposal_id: W1, work_item_id: ITEM_A }, { proposal_id: "someone-elses", work_item_id: "x" }];
  const open = row({ id: W1, received_at: hoursAgo(30), sent_at: hoursAgo(4) });

  it("makes the board for the client with the notes as its brief, puts the context documents on it first and in order, then marks the proposal won", async () => {
    const store = fakeStore({ rows: [open], context: ctx });
    expect(await winProposal(store, W())).toEqual({ ok: true, engagementId: "id-1" });
    expect(store.state.steps).toEqual(["board", "home", "place", "ledger", "claim"]);
    expect(store.state.boards).toEqual([{ id: "id-1", orgId: ORG, title: "Network redesign", clientId: CLIENT, brief: "Met them at the conference.", ownerId: ME }]);
    expect(store.state.placed).toEqual([{ taskId: "task-1", ids: [ITEM_B, ITEM_A] }]);
    expect(store.state.ledger).toEqual([
      { kind: "brief_received", occurred_at: hoursAgo(30) },
      { kind: "sent_to_client", occurred_at: hoursAgo(4) },
      { kind: "won", occurred_at: NOW.toISOString() },
    ]);
    expect(store.state.claims).toEqual([{ id: W1, engagementId: "id-1" }]);
    expect(store.state.removedBoards).toEqual([]);
    expect(store.state.events).toEqual([{ event: "proposal.won", documents: "2-5", notes: "yes", sent_first: "yes" }]);
    expect(EVENT_DIM_KEYS["proposal.won"]).toEqual(["documents", "notes", "sent_first"]);
  });

  it("works with no documents, no notes and no sent date, and leaves out a document deleted since", async () => {
    const bare = fakeStore({ rows: [row({ id: W1 })], context: async () => [], notes: async () => null });
    expect(await winProposal(bare, W())).toMatchObject({ ok: true });
    expect(bare.state.steps).toEqual(["board", "home", "ledger", "claim"]);
    expect(bare.state.boards[0]).toMatchObject({ brief: null });
    expect(bare.state.ledger.map((r) => r.kind)).toEqual(["brief_received", "won"]);
    expect(bare.state.events).toEqual([{ event: "proposal.won", documents: "0", notes: "no", sent_first: "no" }]);
    const gone = fakeStore({ rows: [open], context: ctx, owned: [ITEM_A] });
    await winProposal(gone, W());
    expect(gone.state.placed).toEqual([{ taskId: "task-1", ids: [ITEM_A] }]);
  });

  it("is only for the person who started it: an admin, a lead, another workspace and a made-up id all get the same words and nothing is made", async () => {
    const theirs = row({ id: W1, owner_id: OTHER });
    for (const store of [fakeStore({ rows: [theirs], role: "admin" }), fakeStore({ rows: [theirs], role: "lead" }), fakeStore({ rows: [row({ id: W1, org_id: "another-org" })] }), fakeStore({ rows: [] })]) {
      expect(await winProposal(store, W())).toEqual({ ok: false, problem: WIN_COPY.notYours });
      expect(store.state.steps).toEqual([]);
    }
    expect(() => winInput({ proposal_id: "nope" })).toThrow();
  });

  it("hands back the same board on a second press, and refuses a lost proposal", async () => {
    const won = fakeStore({ rows: [row({ id: W1, status: "won", decided_at: hoursAgo(1), engagement_id: "board-9" })] });
    expect(await winProposal(won, W())).toEqual({ ok: true, engagementId: "board-9" });
    expect(won.state.steps).toEqual([]);
    const lost = fakeStore({ rows: [row({ id: W1, status: "lost", decided_at: hoursAgo(1) })] });
    expect(await winProposal(lost, W())).toEqual({ ok: false, problem: WIN_COPY.lost });
  });

  it("takes the board back and leaves the proposal open when any step fails", async () => {
    const fails: Partial<DeskStore>[] = [
      { boardHome: async () => null },
      { placeItems: async () => false },
      { writeLedger: async () => false },
      { placeItems: async () => { throw new Error("network"); } },
    ];
    for (const over of fails) {
      const store = fakeStore({ rows: [open], context: ctx, ...over });
      expect(await winProposal(store, W())).toEqual({ ok: false, problem: WIN_COPY.failed });
      expect(store.state.removedBoards).toEqual(["id-1"]);
      expect(store.state.claims).toEqual([]);
      expect(store.state.events).toEqual([]);
    }
    const noBoard = fakeStore({ rows: [open], makeBoard: async () => false });
    expect(await winProposal(noBoard, W())).toEqual({ ok: false, problem: WIN_COPY.failed });
    expect(noBoard.state.removedBoards).toEqual([]);
  });

  it("when two presses race, the loser removes its own board and returns the winner's", async () => {
    let reads = 0;
    const store = fakeStore({
      context: ctx,
      proposal: async () => (++reads === 1 ? open : { ...open, status: "won", decided_at: NOW.toISOString(), engagement_id: "winner" }),
      claimWin: async () => false,
    });
    expect(await winProposal(store, W())).toEqual({ ok: true, engagementId: "winner" });
    expect(store.state.removedBoards).toEqual(["id-1"]);
    expect(store.state.events).toEqual([]);
  });

  it("keeps the win when recording the event fails", async () => {
    const store = fakeStore({ rows: [open], context: ctx, record: async () => { throw new Error("down"); } });
    expect(await winProposal(store, W())).toEqual({ ok: true, engagementId: "id-1" });
    expect(store.state.removedBoards).toEqual([]);
  });
});

describe("picking the goal", () => {
  it("offers a few plain choices, keeps a saved goal that is not one of them, and saves only whole hours in range", () => {
    expect(goalChoices(72)).toEqual([24, 48, 72, 96, 120, 168]);
    expect(goalChoices(36)).toEqual([24, 36, 48, 72, 96, 120, 168]);
    expect(goalLabel(24)).toBe("24 hours");
    expect(goalLabel(72)).toBe("72 hours (3 days)");
    expect(goalLabel(36)).toBe("36 hours");
    expect([goalToSave("48"), goalToSave(96), goalToSave("0"), goalToSave("abc"), goalToSave(1.5), goalToSave(721), goalToSave(null)]).toEqual([48, 96, null, null, null, null, null]);
    expect(settingsChangedDims({ section: "workspace", setting: "proposal_goal", change: "updated" })).toEqual({ section: "workspace", setting: "proposal_goal", change: "updated" });
    expect(EVENT_DIM_KEYS["proposal.sent"]).toEqual(["change", "within_goal"]);
  });
});

describe("the menu row and the records", () => {
  const ctx = { canReview: false, canManageMembers: false, canSeeFirmView: false, hasCoachLink: false, affiliated: false, clientsEnabled: true };
  const has = (type: "company" | "personal" | "partner" | "edu", role: string) =>
    navFor({ ...ctx, type, role }, { vocab: DEFAULT_VOCAB, institutionName: null }).flatMap((g) => g.items).some((i) => i.id === "proposals" && i.to === "/proposals" && i.label === "Proposals");

  it("shows Proposals to every member of a company workspace and to nobody else", () => {
    for (const role of ["admin", "lead", "manager", "analyst"]) expect(has("company", role)).toBe(true);
    expect(has("company", "coach")).toBe(false);
    for (const type of ["personal", "partner", "edu"] as const) expect(has(type, "admin")).toBe(false);
  });

  it("registers the event with content-free dims, and the migration only adds", () => {
    expect(EVENT_DIM_KEYS["proposal.created"]).toEqual(["client", "documents", "notes"]);
    const sql = readFileSync("supabase/migrations/20261120010000_proposals.sql", "utf8");
    expect(sql).not.toMatch(/\b(drop table|drop column|alter table [a-z_.]+ (drop|alter column|rename)|truncate|delete from)\b/i);
    expect(sql).toMatch(/alter table public\.proposals enable row level security/);
    expect(sql).toMatch(/alter table public\.proposal_context_items enable row level security/);
    expect(sql).toMatch(/revoke all on table public\.proposals from anon, authenticated/);
    expect(sql).not.toMatch(/for (insert|update|delete|all) to/i);
    expect(sql).not.toContain("\u2014");
  });
});
