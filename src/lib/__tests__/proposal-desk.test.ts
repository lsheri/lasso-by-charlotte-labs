import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { navFor } from "@/components/layout/nav-config";
import { DEFAULT_VOCAB } from "@/lib/edu-vocab";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
import {
  checkNewProposal,
  countBand,
  DEFAULT_GOAL_HOURS,
  deskCounts,
  deskDate,
  deskView,
  goalHours,
  INTAKE_COPY,
  newProposalInput,
  sameClientName,
  timeLeft,
  timeLeftLine,
  type DeskProposal,
} from "@/lib/proposal-desk-shared";
import { createProposal, listDesk, listDeskClients, type DeskCaller, type DeskStore, type ProposalRow } from "@/lib/proposal-desk.server";

const ORG = "11111111-1111-4111-8111-111111111111";
const ME = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const CLIENT = "44444444-4444-4444-8444-444444444444";
const ITEM_A = "55555555-5555-4555-8555-555555555555";
const ITEM_B = "66666666-6666-4666-8666-666666666666";
const NOW = new Date("2026-11-20T12:00:00Z");
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();

const proposal = (over: Partial<DeskProposal>): DeskProposal => ({
  id: "p", title: "Network redesign", clientName: "Marrowfield", ownerName: "Maren", mine: false, status: "open",
  receivedAt: hoursAgo(10), sentAt: null, decidedAt: null, engagementId: null, contextCount: 0, ...over,
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

type Fake = DeskStore & { state: { proposals: Record<string, unknown>[]; context: Record<string, unknown>[]; clients: { id: string; name: string }[]; events: Record<string, string>[]; removedClients: string[] } };

function fakeStore(over: Partial<DeskStore> & { role?: string; rows?: ProposalRow[]; owned?: string[] } = {}): Fake {
  const caller: DeskCaller = { profileId: ME, orgId: ORG, role: over.role ?? "manager", userId: "u" };
  const state: Fake["state"] = { proposals: [], context: [], clients: [{ id: CLIENT, name: "Marrowfield" }], events: [], removedClients: [] };
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
    record: async (_c, _e, dims) => { state.events.push(dims); },
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
    expect(list.proposals[0]).toMatchObject({ mine: true, clientName: "Marrowfield", ownerName: "Harper", contextCount: 1, contextTitles: ["Call notes"] });
    expect(list.goalHours).toBe(48);
    expect(list.canSetGoal).toBe(false);
  });

  it("shows admins and leads the workspace's proposals, a count for others' documents and never their titles", async () => {
    for (const role of ["admin", "lead"]) {
      const list = await listDesk(fakeStore({ rows, role }));
      expect(list.proposals.map((p) => p.id)).toEqual(["p1", "p2"]);
      const theirs = list.proposals.find((p) => p.id === "p2");
      expect(theirs).toMatchObject({ mine: false, ownerName: "Maren", contextCount: 1 });
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
