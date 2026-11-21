// 21 Nov 2026, chat pill PR 4c (D-97): the Lead decides the final proposal. Only the linked lead or the person who
// started it, on an open proposal; only their own work or a document they may open; a new row per choice; a draft
// made from the brief and the documents they may open, with no board, never chosen until they choose it.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import type { LeadProposalRow } from "@/lib/lead-view.server";
import { NUMBER_WITHHELD } from "@/lib/money-mask-shared";
import { chooseFinal, draftFinal, scrubDraftForMember, type FinalStore } from "@/lib/proposal-final.server";
import { chooseFinalInput, draftTitle, FINAL_COPY } from "@/lib/proposal-final-shared";

const ORG = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000a2";
const CHRISTY = "00000000-0000-4000-8000-0000000000c1";
const MAREN = "00000000-0000-4000-8000-0000000000c2";
const ELIF = "00000000-0000-4000-8000-0000000000c3";
const ROW_CHRISTY = "00000000-0000-4000-8000-0000000000d1";
const P1 = "00000000-0000-4000-8000-0000000000e1";
const SENT = "00000000-0000-4000-8000-0000000000f1";
const UNSENT = "00000000-0000-4000-8000-0000000000f2";
const MINE = "00000000-0000-4000-8000-0000000000f3";
const ELIFS = "00000000-0000-4000-8000-0000000000f4";
const NOW = new Date("2026-11-21T12:00:00Z");

type Row = LeadProposalRow;
const proposal = (over: Partial<Row> = {}): Row => ({
  id: P1, org_id: ORG, client_id: "c", title: "Care model review", owner_id: MAREN, received_at: "2026-11-20T12:00:00Z", sent_at: null,
  status: "open", archived_at: null, lead_contact_id: ROW_CHRISTY, client_due_on: null, notes: "Larkspur wants a care model review.", ...over,
});

function world(over: Partial<FinalStore> & { me?: string; role?: string; rows?: Row[]; sent?: string[] | null } = {}) {
  const rows = over.rows ?? [proposal()];
  const items = [
    { id: SENT, owner_id: MAREN, title: "Larkspur RFP" },
    { id: UNSENT, owner_id: MAREN, title: "Maren's notes" },
    { id: MINE, owner_id: CHRISTY, title: "Final proposal v3" },
    { id: ELIFS, owner_id: ELIF, title: "Elif's file" },
  ];
  const inserted: Record<string, unknown>[] = [];
  const events: unknown[] = [];
  const drafts: unknown[] = [];
  const store: FinalStore = {
    caller: async () => ({ profileId: over.me ?? CHRISTY, orgId: ORG, role: over.role ?? "em", userId: "u" }),
    myContacts: async (_o, me) => (me === CHRISTY ? [ROW_CHRISTY] : []),
    ledProposals: async () => rows,
    proposal: async (id) => rows.find((r) => r.id === id) ?? null,
    contacts: async () => [],
    clientNames: async () => new Map(),
    personNames: async () => new Map(),
    context: async (ids) => (ids.includes(P1) ? [{ proposal_id: P1, work_item_id: SENT }, { proposal_id: P1, work_item_id: UNSENT }] : []),
    ownedItems: async (_o, owner, ids) => items.filter((i) => i.owner_id === owner && ids.includes(i.id)).map((i) => ({ id: i.id, title: i.title })),
    settings: async () => null,
    sharedBoards: async () => [],
    itemText: async (_o, id) => (id === SENT ? "RFP words" : "secret"),
    sentDocs: async () => (over.sent === null ? new Map() : new Map([[P1, { contact_id: ROW_CHRISTY, item_ids: over.sent ?? [SENT] }]])),
    saveSent: async () => true,
    record: async (_c, type, dims) => void events.push({ type, dims }),
    now: () => NOW,
    item: async (_o, id) => items.find((i) => i.id === id) ?? null,
    latestVersion: async (id) => (id === MINE ? "v-3" : null),
    insertFinal: async (row) => {
      inserted.push(row);
      return true;
    },
    makeDraft: async (_c, input) => {
      drafts.push(input);
      return { itemId: "draft-1", title: input.title, gaps: 2, questions: 4 };
    },
    recordDraft: async (_c, dims) => void events.push({ type: "proposal.final_drafted", dims }),
    ...over,
  };
  return { store, inserted, events, drafts };
}
const choose = (item: string, source: "upload" | "draft" | "document" = "upload") => ({ profile_id: null, proposal_id: P1, work_item_id: item, source });

describe("choosing the final", () => {
  it("the lead chooses their own upload: one row with the latest version, who and when; one event", async () => {
    const { store, inserted, events } = world();
    const result = await chooseFinal(store, choose(MINE));
    expect(result).toEqual({ ok: true, final: { itemId: MINE, title: "Final proposal v3", chosenAt: NOW.toISOString() } });
    expect(inserted).toEqual([{ org_id: ORG, proposal_id: P1, work_item_id: MINE, document_version_id: "v-3", chosen_by: CHRISTY, chosen_at: NOW.toISOString() }]);
    expect(events).toEqual([{ type: "proposal.final_chosen", dims: { source: "upload" } }]);
  });

  it("the lead may choose a document the owner sent, never one not sent, never someone else's work", async () => {
    expect((await chooseFinal(world().store, choose(SENT, "document"))).ok).toBe(true);
    for (const item of [UNSENT, ELIFS, "00000000-0000-4000-8000-0000000000ff"]) {
      const { store, inserted } = world();
      expect(await chooseFinal(store, choose(item, "document"))).toEqual({ ok: false, problem: FINAL_COPY.notYours });
      expect(inserted).toEqual([]);
    }
    // Before any send, not even the first document.
    expect(await chooseFinal(world({ sent: null }).store, choose(SENT, "document"))).toEqual({ ok: false, problem: FINAL_COPY.notYours });
  });

  it("the owner may choose any of their own documents on it", async () => {
    expect((await chooseFinal(world({ me: MAREN, role: "admin" }).store, choose(UNSENT, "document"))).ok).toBe(true);
  });

  it("someone who neither leads nor started it is refused before anything is read about the item", async () => {
    const item = vi.fn(async () => null);
    const { store, inserted } = world({ me: ELIF, item });
    expect(await chooseFinal(store, choose(ELIFS))).toEqual({ ok: false, problem: FINAL_COPY.notLead });
    expect(item).not.toHaveBeenCalled();
    expect(inserted).toEqual([]);
  });

  it("a closed, archived or another workspace's proposal is refused", async () => {
    expect(await chooseFinal(world({ rows: [proposal({ status: "won" })] }).store, choose(MINE))).toEqual({ ok: false, problem: FINAL_COPY.closed });
    expect(await chooseFinal(world({ rows: [proposal({ archived_at: "2026-11-21" })] }).store, choose(MINE))).toEqual({ ok: false, problem: FINAL_COPY.closed });
    expect(await chooseFinal(world({ rows: [proposal({ org_id: OTHER })] }).store, choose(MINE))).toEqual({ ok: false, problem: FINAL_COPY.notLead });
  });

  it("a document that is not theirs is always counted as a document, whatever the browser said", async () => {
    const { store, events } = world();
    await chooseFinal(store, choose(SENT, "draft"));
    expect(events).toEqual([{ type: "proposal.final_chosen", dims: { source: "document" } }]);
  });

  it("before the SQL it says not ready; a failed write says so", async () => {
    expect(await chooseFinal(world({ insertFinal: async () => "absent" }).store, choose(MINE))).toEqual({ ok: false, problem: FINAL_COPY.notReady });
    expect(await chooseFinal(world({ insertFinal: async () => false }).store, choose(MINE))).toEqual({ ok: false, problem: FINAL_COPY.failed });
  });

  it("the input keeps ids and a known source only", () => {
    expect(() => chooseFinalInput({ proposal_id: P1, work_item_id: MINE, source: "magic" })).toThrow(FINAL_COPY.failed);
    expect(chooseFinalInput({ proposal_id: P1, work_item_id: MINE, source: "draft", extra: 1 })).toEqual({ profile_id: null, proposal_id: P1, work_item_id: MINE, source: "draft" });
  });
});

describe("drafting from the brief", () => {
  it("drafts from the notes and only the documents sent, never one not sent; nothing is chosen yet", async () => {
    const { store, drafts, inserted, events } = world();
    const result = await draftFinal(store, { profile_id: null, proposal_id: P1 });
    expect(result).toEqual({ ok: true, itemId: "draft-1", title: draftTitle("Care model review"), gaps: 2, questions: 4 });
    expect(drafts).toEqual([{ title: "Proposal draft: Care model review", intake: "Larkspur wants a care model review.", documents: [{ id: SENT, title: "Larkspur RFP", text: "RFP words" }], member: true }]);
    expect(JSON.stringify(drafts)).not.toContain("secret");
    expect(inserted).toEqual([]);
    expect(events).toEqual([{ type: "proposal.final_drafted", dims: { gaps: "2-5", questions: "2-5" } }]);
  });

  it("a Member lead's draft reads the brief and documents with numbers withheld; a Lead-role teammate's reads them as written", async () => {
    const notes = "Budget 50-60k. Day rate: 950.";
    const member = world({ rows: [proposal({ notes })], itemText: async () => "Discovery: 18,000" });
    await draftFinal(member.store, { profile_id: null, proposal_id: P1 });
    expect(JSON.stringify(member.drafts)).not.toMatch(/50-60k|950|18,000/);
    const lead = world({ role: "lead", rows: [proposal({ notes })], itemText: async () => "Discovery: 18,000" });
    await draftFinal(lead.store, { profile_id: null, proposal_id: P1 });
    expect(JSON.stringify(lead.drafts)).toMatch(/950/);
  });

  it("with no brief and nothing sent, it refuses before any model call", async () => {
    const makeDraft = vi.fn();
    const { store } = world({ rows: [proposal({ notes: null })], sent: null, makeDraft });
    expect(await draftFinal(store, { profile_id: null, proposal_id: P1 })).toEqual({ ok: false, problem: FINAL_COPY.noBrief });
    expect(makeDraft).not.toHaveBeenCalled();
  });

  it("someone else is refused before any model call", async () => {
    const makeDraft = vi.fn();
    expect(await draftFinal(world({ me: ELIF, makeDraft }).store, { profile_id: null, proposal_id: P1 })).toEqual({ ok: false, problem: FINAL_COPY.notLead });
    expect(makeDraft).not.toHaveBeenCalled();
  });

  it("the daily limit says so in its own words; any other fault is a plain line", async () => {
    const limited = world({ makeDraft: async () => { throw new Response("Today's firm brain limit is reached.", { status: 429 }); } });
    expect(await draftFinal(limited.store, { profile_id: null, proposal_id: P1 })).toEqual({ ok: false, problem: "Today's firm brain limit is reached." });
    expect(await draftFinal(world({ makeDraft: async () => { throw new Error("boom"); } }).store, { profile_id: null, proposal_id: P1 })).toEqual({ ok: false, problem: FINAL_COPY.draftFailed });
    expect(await draftFinal(world({ makeDraft: async () => null }).store, { profile_id: null, proposal_id: P1 })).toEqual({ ok: false, problem: FINAL_COPY.draftFailed });
  });

  it("the source: the draft engine is the one that never reads a fee or another client's name, and the draft is the caller's own unplaced work", () => {
    const source = readFileSync("src/lib/proposal-final.server.ts", "utf8");
    expect(source).toContain('const { runProposalDraft } = await import("./proposal-draft.server")');
    expect(source).toContain('surface: "proposal_draft"');
    expect(source).toContain('visibility: "unmapped"');
    expect(source).toContain("precedentIds: []");
    const engine = readFileSync("src/lib/proposal-draft.server.ts", "utf8");
    expect(engine).toContain("const intake = maskFees(input.intake);");
  });

  it("the SQL is one server-only table and its index; the undo drops it", () => {
    const sql = readFileSync("supabase/migrations/20261121040000_proposal_final_versions.sql", "utf8");
    expect(sql).toMatch(/create table if not exists public\.proposal_final_versions/);
    expect(sql).toMatch(/revoke all on table public\.proposal_final_versions from public, anon, authenticated/);
    expect(sql).not.toMatch(/create policy|grant [^;]* to (anon|authenticated)/i);
    expect(readFileSync("supabase/undo/20261121040000_proposal_final_versions_undo.sql", "utf8")).toContain("drop table if exists public.proposal_final_versions");
  });
});

// QA of PR 300: a Member lead's draft carries no figures, wherever the model got them from.
describe("QA H1 of PR 300", () => {
  const section = (body: string, quote = "Day rate: 950") => ({ key: "approach" as const, heading: "Approach", body, status: "draft" as const, sources: [{ kind: "fact" as const, itemId: "i1", itemTitle: "RFP", quote }], flags: [] });
  const draft = (bodies: string[]) => ({
    sections: bodies.map((body) => section(body)),
    questions: [{ text: "Is 2000 per workshop right?", fallback: "Expenses 5,000 at cost" }],
    checks: { names: "passed" as const, blocked: 0, figuresRemoved: 0, newFacts: 0 },
    precedentIds: [],
    createdAt: "2026-11-21T00:00:00Z",
  });

  it("scrubs the model's reply: QA's sentences, quotes and questions lose every figure", () => {
    const out = scrubDraftForMember(draft(["Our day rate is 950 and each workshop is 2000.", "Expenses 5,000 are billed at cost.", "Total investment 48,500 ex VAT."]));
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/950|2000|5,000|48,500/);
    expect(out.sections[0]!.body).toContain(NUMBER_WITHHELD);
  });

  it("keeps what is not money: dates, weeks, small counts", () => {
    const out = scrubDraftForMember(draft(["Kick-off in Week 3, with 3 workshops, by Q4 2026."]));
    expect(out.sections[0]!.body).toBe("Kick-off in Week 3, with 3 workshops, by Q4 2026.");
  });

  it("the draft is made with member true for a Member and false for a Lead-role teammate", async () => {
    const member = world();
    await draftFinal(member.store, { profile_id: null, proposal_id: P1 });
    expect((member.drafts[0] as { member: boolean }).member).toBe(true);
    const lead = world({ role: "lead" });
    await draftFinal(lead.store, { profile_id: null, proposal_id: P1 });
    expect((lead.drafts[0] as { member: boolean }).member).toBe(false);
  });

  it("the source: for a Member, what the draft engine reads (the exemplar too) and what is saved go through the blunt mask", () => {
    const source = readFileSync("src/lib/proposal-final.server.ts", "utf8");
    expect(source).toMatch(/input\.member \? numbersWithheld\(text\) : text/);
    expect(source).toMatch(/const draft = input\.member \? scrubDraftForMember\(written\) : written;/);
    const engine = readFileSync("src/lib/proposal-draft.server.ts", "utf8");
    expect(engine.slice(engine.indexOf("export async function buildExemplar"), engine.indexOf("const DRAFT_SYSTEM"))).toContain("await read(pick.id)");
  });

  it("the SQL is append only for the server, and a deleted document leaves its choice with no item (QA L1, L2)", () => {
    const sql = readFileSync("supabase/migrations/20261121040000_proposal_final_versions.sql", "utf8");
    expect(sql).toMatch(/revoke update, delete, truncate on table public\.proposal_final_versions from service_role/);
    expect(sql).toMatch(/work_item_id uuid references public\.work_items\(id\) on delete set null/);
  });
});

describe("QA M1 of PR 300: the draft title for a Member", () => {
  it("drops a currency amount from the proposal title and keeps other numbers; a Lead-role teammate's keeps it", async () => {
    const member = world({ rows: [proposal({ title: "Care model review, $80k cap, phase 2" })] });
    await draftFinal(member.store, { profile_id: null, proposal_id: P1 });
    expect((member.drafts[0] as { title: string }).title).toBe("Proposal draft: Care model review, cap, phase 2");
    const lead = world({ role: "lead", rows: [proposal({ title: "Care model review, $80k cap, phase 2" })] });
    await draftFinal(lead.store, { profile_id: null, proposal_id: P1 });
    expect((lead.drafts[0] as { title: string }).title).toBe("Proposal draft: Care model review, $80k cap, phase 2");
  });
});

describe("the Member draft title uses the one title rule", () => {
  it("'Budget: 45,000 for phase 2' and 'Fee 2000 refresh'", async () => {
    for (const [title, expected] of [["Budget: 45,000 for phase 2", "Proposal draft: Budget for phase 2"], ["Fee 2000 refresh", "Proposal draft: Fee refresh"]] as const) {
      const w = world({ rows: [proposal({ title })] });
      await draftFinal(w.store, { profile_id: null, proposal_id: P1 });
      expect((w.drafts[0] as { title: string }).title).toBe(expected);
    }
  });
});
