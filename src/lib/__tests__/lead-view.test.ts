// 21 Nov 2026, chat pill PR 4b (D-97): what a proposal's Lead sees. Only the linked teammate; documents only after the
// owner sends them to that same lead; past work only from boards shared with the firm; amounts withheld for Members.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { docsSentToLead, sendState, LEAD_VIEW_COPY, leadDocInput, ledInput, SEND_DOCS_COPY, sendDocsInput, upNextOrder, type LedProposal } from "@/lib/lead-view-shared";
import { MONEY_SECTION_WITHHELD, MONEY_WITHHELD } from "@/lib/money-mask-shared";
import { listLed, readLeadDocument, sendLeadDocuments, type LeadProposalRow, type LeadStore } from "@/lib/lead-view.server";

const ORG = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000a2";
const CHRISTY = "00000000-0000-4000-8000-0000000000c1";
const MAREN = "00000000-0000-4000-8000-0000000000c2";
const ROW_CHRISTY = "00000000-0000-4000-8000-0000000000d1";
const ROW_BEN = "00000000-0000-4000-8000-0000000000d2";
const P1 = "00000000-0000-4000-8000-0000000000e1";
const P2 = "00000000-0000-4000-8000-0000000000e2";
const DOC = "00000000-0000-4000-8000-0000000000f1";
const PRIVATE = "00000000-0000-4000-8000-0000000000f2";
const NOW = new Date("2026-11-21T12:00:00Z");

/** A proposal as stored, with what was sent to its lead beside it (the proposal_lead_docs row, for the fake store). */
type Row = LeadProposalRow & { sent?: string | null; sentItems?: string[] };
const proposal = (over: Partial<Row> = {}): Row => ({
  id: P1,
  org_id: ORG,
  client_id: "c-larkspur",
  title: "Care model review",
  owner_id: MAREN,
  received_at: "2026-11-20T12:00:00Z",
  sent_at: null,
  status: "open",
  archived_at: null,
  lead_contact_id: ROW_CHRISTY,
  client_due_on: "2026-11-28",
  notes: "Larkspur wants a care model review. Fixed fee of $45,000 plus expenses.",
  sent: null,
  ...over,
});

function world(over: Partial<LeadStore> & { role?: string; me?: string; rows?: Row[]; links?: Record<string, string | null>; items?: { id: string; owner: string; title: string; org?: string }[]; ctx?: { proposal_id: string; work_item_id: string }[] } = {}) {
  const rows = over.rows ?? [proposal()];
  const links = over.links ?? { [ROW_CHRISTY]: CHRISTY, [ROW_BEN]: null };
  const items = over.items ?? [
    { id: DOC, owner: MAREN, title: "Larkspur RFP" },
    { id: PRIVATE, owner: MAREN, title: "Maren's private notes" },
  ];
  const context = over.ctx ?? [{ proposal_id: P1, work_item_id: DOC }];
  const writes: unknown[] = [];
  const events: unknown[] = [];
  const me = over.me ?? CHRISTY;
  const store: LeadStore = {
    caller: async () => ({ profileId: me, orgId: ORG, role: over.role ?? "em", userId: "u" }),
    myContacts: async (orgId, profileId) => Object.entries(links).filter(([, p]) => p === profileId && orgId === ORG).map(([id]) => id),
    ledProposals: async (orgId, ids) => rows.filter((r) => r.org_id === orgId && r.status === "open" && !r.archived_at && ids.includes(r.lead_contact_id ?? "")),
    proposal: async (id) => rows.find((r) => r.id === id) ?? null,
    contacts: async (_orgId, ids) => ids.map((id) => ({ id, profile_id: links[id] ?? null })),
    clientNames: async () => new Map([["c-larkspur", "Larkspur Senior Living"]]),
    personNames: async () => new Map([[MAREN, "Maren Hollis"]]),
    context: async (ids) => context.filter((c) => ids.includes(c.proposal_id)),
    ownedItems: async (orgId, owner, ids) => items.filter((i) => (i.org ?? ORG) === orgId && i.owner === owner && ids.includes(i.id)).map((i) => ({ id: i.id, title: i.title })),
    settings: async () => ({ proposal_goal_hours: 72 }),
    sharedBoards: async () => [
      { id: "b1", title: "Larkspur 2024 staffing", client: "Larkspur Senior Living", created_at: "2024-01-01" },
      { id: "b2", title: "Larkspur 2025 review", client: "Larkspur Senior Living", created_at: "2025-01-01" },
      { id: "b3", title: "Pellham pricing", client: "Pellham", created_at: "2025-02-01" },
    ],
    itemText: async (_orgId, id) => (id === DOC ? "Scope and Fees.\nThe fee is $120k per month." : "secret"),
    sentDocs: async (orgId, ids) =>
      new Map(rows.filter((r) => r.org_id === orgId && ids.includes(r.id) && r.sent).map((r) => [r.id, { contact_id: r.sent as string, item_ids: r.sentItems ?? [DOC] }])),
    saveSent: async (id, _orgId, sent) => {
      writes.push(sent ? { id, to: sent.contact_id, items: sent.item_ids, at: sent.sent_at } : { id, to: null });
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.sent = sent?.contact_id ?? null;
        row.sentItems = sent?.item_ids ?? [];
      }
      return true;
    },
    record: async (_c, type, dims) => void events.push({ type, dims }),
    now: () => NOW,
    ...over,
  };
  return { store, rows, writes, events };
}

describe("the pure rules", () => {
  it("documents count as sent only to the People row that is the lead now", () => {
    const sent = { contact_id: ROW_CHRISTY, item_ids: [DOC] };
    expect(docsSentToLead({ lead_contact_id: ROW_CHRISTY }, sent)).toBe(true);
    expect(docsSentToLead({ lead_contact_id: ROW_BEN }, sent)).toBe(false);
    expect(docsSentToLead({ lead_contact_id: null }, null)).toBe(false);
    expect(docsSentToLead({ lead_contact_id: ROW_CHRISTY }, undefined)).toBe(false);
    // The owner's row: everything sent, something added since, not yet, no login.
    expect(sendState({ lead_contact_id: ROW_CHRISTY }, sent, [DOC], true)).toBe("sent");
    expect(sendState({ lead_contact_id: ROW_CHRISTY }, sent, [DOC, PRIVATE], true)).toBe("more");
    expect(sendState({ lead_contact_id: ROW_CHRISTY }, null, [DOC], true)).toBe("unsent");
    expect(sendState({ lead_contact_id: ROW_BEN }, null, [DOC], false)).toBe("no_login");
  });

  it("Up next is the one over or closest to its goal; sent ones go last", () => {
    const base = { title: "", clientName: "", ownerName: "", dueOn: null, brief: null, documents: null, documentCount: 0, pastWork: [] };
    const rows: LedProposal[] = [
      { ...base, id: "fresh", receivedAt: "2026-11-21T10:00:00Z", sentAt: null },
      { ...base, id: "sent", receivedAt: "2026-11-15T10:00:00Z", sentAt: "2026-11-16T10:00:00Z" },
      { ...base, id: "over", receivedAt: "2026-11-17T10:00:00Z", sentAt: null },
      { ...base, id: "close", receivedAt: "2026-11-19T00:00:00Z", sentAt: null },
    ];
    expect(upNextOrder(rows, 72, NOW).map((r) => r.id)).toEqual(["over", "close", "fresh", "sent"]);
  });

  it("inputs keep ids only and refuse a document without one", () => {
    expect(ledInput({ profile_id: "x" })).toEqual({ profile_id: null });
    expect(() => leadDocInput({ proposal_id: P1, work_item_id: "nope" })).toThrow(LEAD_VIEW_COPY.docGone);
    expect(sendDocsInput({ proposal_id: P1 })).toEqual({ profile_id: null, proposal_id: P1, send: true });
    expect(sendDocsInput({ proposal_id: P1, send: false }).send).toBe(false);
  });
});

describe("listLed", () => {
  it("gives the linked lead their open proposal: brief, clock data, due date, a count of documents not yet sent, past work for the client", async () => {
    const { store } = world();
    const list = await listLed(store);
    expect(list.goalHours).toBe(72);
    expect(list.proposals).toHaveLength(1);
    const [row] = list.proposals;
    expect(row).toMatchObject({ id: P1, clientName: "Larkspur Senior Living", ownerName: "Maren Hollis", dueOn: "2026-11-28", documents: null, documentCount: 1 });
    expect(row!.pastWork.map((w) => w.title)).toEqual(["Larkspur 2025 review", "Larkspur 2024 staffing"]);
    // Titles of documents not sent never travel.
    expect(JSON.stringify(list)).not.toContain("Larkspur RFP");
  });

  it("a Member who leads never sees money in the brief; a Lead-role teammate does", async () => {
    const member = (await listLed(world({ role: "em" }).store)).proposals[0]!.brief!;
    expect(member).not.toMatch(/45,000|\$/);
    expect(member).toContain(MONEY_WITHHELD);
    const lead = (await listLed(world({ role: "lead" }).store)).proposals[0]!.brief!;
    expect(lead).toContain("$45,000");
  });

  it("after the owner sends them, the documents are listed by title, in order, and only the owner's own work", async () => {
    const { store } = world({
      rows: [proposal({ sent: ROW_CHRISTY })],
      ctx: [
        { proposal_id: P1, work_item_id: DOC },
        { proposal_id: P1, work_item_id: "not-mine" },
      ],
    });
    const [row] = (await listLed(store)).proposals;
    expect(row!.documents).toEqual([{ id: DOC, title: "Larkspur RFP" }]);
    expect(row!.documentCount).toBe(1);
  });

  it("documents sent to a previous lead stay closed for the new one", async () => {
    const { store } = world({ links: { [ROW_BEN]: CHRISTY }, rows: [proposal({ lead_contact_id: ROW_BEN, sent: ROW_CHRISTY })] });
    expect((await listLed(store)).proposals[0]!.documents).toBeNull();
  });

  it("someone else, an unlinked lead, a closed, archived or another workspace's proposal: nothing", async () => {
    expect((await listLed(world({ me: MAREN }).store)).proposals).toEqual([]);
    expect((await listLed(world({ links: { [ROW_CHRISTY]: null } }).store)).proposals).toEqual([]);
    for (const over of [{ status: "won" }, { status: "lost" }, { archived_at: "2026-11-21" }, { org_id: OTHER }])
      expect((await listLed(world({ rows: [proposal(over)] }).store)).proposals).toEqual([]);
  });

  it("a read that hands back too much is filtered again", async () => {
    const { store } = world({ ledProposals: async () => [proposal(), proposal({ id: P2, lead_contact_id: ROW_BEN }), proposal({ id: "x", org_id: OTHER })] });
    expect((await listLed(store)).proposals.map((p) => p.id)).toEqual([P1]);
  });

  it("before the 4a SQL, nobody leads anything; a failed read says so instead of showing nothing", async () => {
    expect((await listLed(world({ myContacts: async () => "absent" }).store)).proposals).toEqual([]);
    await expect(listLed(world({ myContacts: async () => null }).store)).rejects.toThrow();
    await expect(listLed(world({ ledProposals: async () => null }).store)).rejects.toThrow();
  });

  it("past work never comes from an unshared board: the store is asked only for shared ones", () => {
    const source = readFileSync("src/lib/lead-view.server.ts", "utf8");
    const read = source.slice(source.indexOf("async sharedBoards"), source.indexOf("async itemText"));
    expect(read).toContain('.eq("shared_with_firm", true)');
    expect(read).toContain('.is("archived_at", null)');
    expect(read).toContain('.eq("org_id", orgId)');
  });
});

describe("readLeadDocument", () => {
  const sent = () => world({ rows: [proposal({ sent: ROW_CHRISTY })] });

  it("opens a sent document for the lead, amounts withheld for a Member, and records only that", async () => {
    const { store, events } = sent();
    const result = await readLeadDocument(store, { profile_id: null, proposal_id: P1, work_item_id: DOC });
    expect(result).toMatchObject({ ok: true, title: "Larkspur RFP", withheld: true });
    expect(result.ok && result.text).not.toContain("$120k");
    expect(events).toEqual([{ type: "lead_view.document_opened", dims: { withheld: "yes" } }]);
  });

  it("a Lead-role teammate reads the figures", async () => {
    const { store } = world({ role: "lead", rows: [proposal({ sent: ROW_CHRISTY })] });
    const result = await readLeadDocument(store, { profile_id: null, proposal_id: P1, work_item_id: DOC });
    expect(result.ok && result.text).toContain("$120k");
  });

  it("every way it is not theirs reads the same: not sent, sent to someone else, not on the proposal, someone else's work, not the lead, closed", async () => {
    const gone = { ok: false, problem: LEAD_VIEW_COPY.docGone };
    const cases: [ReturnType<typeof world>, string][] = [
      [world(), DOC],
      [world({ rows: [proposal({ sent: ROW_BEN })] }), DOC],
      [sent(), PRIVATE],
      [world({ rows: [proposal({ sent: ROW_CHRISTY })], items: [{ id: DOC, owner: CHRISTY, title: "x" }] }), DOC],
      [world({ me: MAREN, rows: [proposal({ sent: ROW_CHRISTY })] }), DOC],
      [world({ rows: [proposal({ sent: ROW_CHRISTY, status: "won" })] }), DOC],
      [world({ rows: [proposal({ sent: ROW_CHRISTY, org_id: OTHER })] }), DOC],
    ];
    for (const [w, item] of cases) {
      const text = vi.fn(w.store.itemText);
      w.store.itemText = text;
      expect(await readLeadDocument(w.store, { profile_id: null, proposal_id: P1, work_item_id: item })).toEqual(gone);
      expect(text).not.toHaveBeenCalled();
    }
  });

  it("a giant document opens at its start, saying so", async () => {
    const { store } = world({ role: "lead", rows: [proposal({ sent: ROW_CHRISTY })], itemText: async () => "x".repeat(200_000) });
    const result = await readLeadDocument(store, { profile_id: null, proposal_id: P1, work_item_id: DOC });
    expect(result.ok && result.text.length).toBeLessThan(50_200);
    expect(result.ok && result.text.endsWith(LEAD_VIEW_COPY.clipped)).toBe(true);
  });

  it("a document with no readable words says it could not be opened", async () => {
    const { store } = world({ rows: [proposal({ sent: ROW_CHRISTY })], itemText: async () => null });
    expect(await readLeadDocument(store, { profile_id: null, proposal_id: P1, work_item_id: DOC })).toEqual({ ok: false, problem: LEAD_VIEW_COPY.docFailed });
  });
});

describe("sendLeadDocuments", () => {
  it("the owner sends them to a teammate lead: one write, one event with a count band", async () => {
    const { store, writes, events } = world({ me: MAREN, role: "admin" });
    expect(await sendLeadDocuments(store, { profile_id: null, proposal_id: P1, send: true })).toEqual({ ok: true });
    expect(writes).toEqual([{ id: P1, to: ROW_CHRISTY, items: [DOC], at: NOW.toISOString() }]);
    expect(events).toEqual([{ type: "proposal.docs_to_lead", dims: { documents: "1" } }]);
  });

  it("a second press writes nothing; Stop sharing clears it", async () => {
    const { store, writes } = world({ me: MAREN, rows: [proposal({ sent: ROW_CHRISTY })] });
    expect(await sendLeadDocuments(store, { profile_id: null, proposal_id: P1, send: true })).toEqual({ ok: true });
    expect(writes).toEqual([]);
    expect(await sendLeadDocuments(store, { profile_id: null, proposal_id: P1, send: false })).toEqual({ ok: true });
    expect(writes).toEqual([{ id: P1, to: null }]);
  });

  it("only the owner: an admin, a lead or the lead themselves is refused, and nothing is written", async () => {
    for (const [me, role] of [[CHRISTY, "lead"], ["someone", "admin"]] as const) {
      const { store, writes } = world({ me, role });
      expect(await sendLeadDocuments(store, { profile_id: null, proposal_id: P1, send: true })).toEqual({ ok: false, problem: SEND_DOCS_COPY.ownerOnly });
      expect(writes).toEqual([]);
    }
  });

  it("refuses plainly: no lead, a lead with no login, no documents, a closed proposal, before the SQL", async () => {
    const send = (w: ReturnType<typeof world>) => sendLeadDocuments(w.store, { profile_id: null, proposal_id: P1, send: true });
    expect(await send(world({ me: MAREN, rows: [proposal({ lead_contact_id: null })] }))).toEqual({ ok: false, problem: SEND_DOCS_COPY.noLead });
    expect(await send(world({ me: MAREN, rows: [proposal({ lead_contact_id: ROW_BEN })] }))).toEqual({ ok: false, problem: SEND_DOCS_COPY.noLogin("") });
    expect(await send(world({ me: MAREN, ctx: [] }))).toEqual({ ok: false, problem: SEND_DOCS_COPY.noDocs });
    expect(await send(world({ me: MAREN, rows: [proposal({ status: "won" })] }))).toEqual({ ok: false, problem: SEND_DOCS_COPY.closed });
    expect(await send(world({ me: MAREN, saveSent: async () => "absent" }))).toEqual({ ok: false, problem: SEND_DOCS_COPY.notReady });
    expect(await send(world({ me: MAREN, saveSent: async () => false }))).toEqual({ ok: false, problem: SEND_DOCS_COPY.failed });
  });

  it("the SQL is one server-only table, never readable from a browser (QA L3 of PR 299); the undo drops it", () => {
    const sql = readFileSync("supabase/migrations/20261121030000_proposal_lead_docs.sql", "utf8");
    expect(sql).toMatch(/create table if not exists public\.proposal_lead_docs/);
    expect(sql).toMatch(/item_ids uuid\[\] not null/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on table public\.proposal_lead_docs from public, anon, authenticated/);
    expect(sql).not.toMatch(/create policy|grant [^;]* to (anon|authenticated)|alter table public\.proposals/i);
    const undo = readFileSync("supabase/undo/20261121030000_proposal_lead_docs_undo.sql", "utf8");
    expect(undo).toContain("drop table if exists public.proposal_lead_docs");
  });
});

describe("the floors, read from the source", () => {
  it("every read starts with requireFirmMember, which refuses a deactivated person, a guest and a coach (QA of PR 298, L5)", () => {
    const server = readFileSync("src/lib/lead-view.server.ts", "utf8");
    expect(server).toMatch(/const \{ profile, supabaseAdmin \} = await requireFirmMember\(context\.supabase, context\.userId, profileId\);/);
    const gate = readFileSync("src/lib/firm-corpus.server.ts", "utf8");
    expect(gate).toMatch(/profile\.role === "coach"/);
    expect(gate).toMatch(/me\.is_guest \|\| me\.deactivated_at/);
    const fns = readFileSync("src/lib/lead-view.functions.ts", "utf8");
    expect(fns.match(/\.middleware\(\[requireSupabaseAuth\]\)/g)).toHaveLength(3);
  });

  it("the lead is found by the caller's own link, read fresh on every call, and never from the browser", () => {
    const server = readFileSync("src/lib/lead-view.server.ts", "utf8");
    expect(server).toContain('.eq("profile_id", me)');
    expect(readFileSync("src/lib/lead-view-shared.ts", "utf8")).not.toMatch(/contact_id"?\]|lead_contact_id"\]/);
  });
});

// QA of PR 299: H1 (a Member lead saw ranges, number words, bare price tables and day rates), L1 (titles), M1 (a
// document added after the send opened without a new send).
describe("QA of PR 299", () => {
  const BRIEF = ["Budget 50-60k", "They pay 45 thousand a month", "Rate 1,250/day", "Price: forty thousand dollars", "Fees", "Phase 1: 20,000", "Phase 2: 30,000"].join("\n");
  const RFP = ["Scope", "Review the care model.", "", "Pricing and payment", "Discovery: 18,000", "Delivery: 42,000", "Total not to exceed 60k", "Investment: one hundred thousand dollars"].join("\n");
  const FIGURES = /50-60k|45 thousand|1,250|forty thousand|20,000|30,000|18,000|42,000|60k|one hundred thousand/;

  it("H1: the brief reaches a Member with every one of those figures withheld; a Lead-role teammate reads them", async () => {
    const member = (await listLed(world({ role: "em", rows: [proposal({ notes: BRIEF })] }).store)).proposals[0]!.brief!;
    expect(member).not.toMatch(FIGURES);
    const lead = (await listLed(world({ role: "lead", rows: [proposal({ notes: BRIEF })] }).store)).proposals[0]!.brief!;
    expect(lead).toBe(BRIEF);
  });

  it("H1: an RFP with a bare price table opens for a Member with the pricing withheld and says so", async () => {
    const { store } = world({ rows: [proposal({ sent: ROW_CHRISTY })], itemText: async () => RFP });
    const result = await readLeadDocument(store, { profile_id: null, proposal_id: P1, work_item_id: DOC });
    expect(result.ok && result.withheld).toBe(true);
    expect(result.ok && result.text).not.toMatch(FIGURES);
    expect(result.ok && result.text).toContain(MONEY_SECTION_WITHHELD);
    expect(result.ok && result.text).toContain("Review the care model.");
  });

  it("L1: titles lose their figures for a Member, and keep them for a Lead-role teammate", async () => {
    const rows = [proposal({ title: "Care model review, $80k cap", sent: ROW_CHRISTY })];
    const items = [{ id: DOC, owner: MAREN, title: "Fee schedule $45,000" }];
    const member = (await listLed(world({ rows, items }).store)).proposals[0]!;
    expect(member.title).toBe("Care model review, cap");
    expect(member.documents).toEqual([{ id: DOC, title: "Fee schedule" }]);
    const lead = (await listLed(world({ role: "lead", rows: [proposal({ title: "Care model review, $80k cap", sent: ROW_CHRISTY })], items }).store)).proposals[0]!;
    expect(lead.title).toContain("$80k");
  });

  it("M1: a document added after the send is not listed and does not open until the owner sends again", async () => {
    const ctx = [
      { proposal_id: P1, work_item_id: DOC },
      { proposal_id: P1, work_item_id: PRIVATE },
    ];
    const w = world({ rows: [proposal({ sent: ROW_CHRISTY, sentItems: [DOC] })], ctx });
    const [row] = (await listLed(w.store)).proposals;
    expect(row!.documents!.map((d) => d.id)).toEqual([DOC]);
    expect(row!.documentCount).toBe(2);
    expect(await readLeadDocument(w.store, { profile_id: null, proposal_id: P1, work_item_id: PRIVATE })).toEqual({ ok: false, problem: LEAD_VIEW_COPY.docGone });
    // The owner sends again: now both.
    const owner = world({ me: MAREN, rows: w.rows, ctx });
    expect(await sendLeadDocuments(owner.store, { profile_id: null, proposal_id: P1, send: true })).toEqual({ ok: true });
    expect(owner.writes).toEqual([{ id: P1, to: ROW_CHRISTY, items: [DOC, PRIVATE], at: NOW.toISOString() }]);
    expect((await readLeadDocument(w.store, { profile_id: null, proposal_id: P1, work_item_id: PRIVATE })).ok).toBe(true);
  });
});
