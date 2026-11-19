// 19 Nov, Firm Brain Build Spec step 9: the proposal ledger's server functions, against an in-memory database that
// answers as the applied migration would (read rules for a user client, unique indexes and the guard for the admin
// client). Each role for every function, direct calls that skip the screen, retries, and which client reads.
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProposalDraft } from "@/lib/proposal-draft-shared";
import { LEDGER_COPY, ledgerBoardInput, ledgerProfileInput, ledgerShownInput, ledgerStepInput, ledgerValueInput, type BoardValueSoFar, type FirmValueSoFar, type StepResult, type ValueResult } from "@/lib/proposal-ledger-shared";

import {
  ADMIN_OWN_UNSHARED,
  DECK_ITEM,
  DRAFT_ITEM,
  firm,
  ORG,
  OTHER_ORG,
  OTHER_ORG_BOARD,
  PEOPLE,
  PROPOSAL_ITEM,
  SHARED_BOARD,
  UNSHARED_BOARD,
  uuid,
  type FakeLedger,
  type PersonKey,
} from "./helpers/fake-ledger-db";

const h = vi.hoisted(() => ({ db: null as unknown as { admin: () => unknown } }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => (h.db.admin() as { from: (name: string) => unknown }).from(table) } }));
vi.mock("@/lib/background", () => ({ runAfterResponse: (work: () => Promise<unknown>) => void work() }));

import * as server from "@/lib/proposal-ledger.server";

// The build rewrites the functions file into stubs, so a test cannot call through it. Each server function is its
// validator (shared file) and its handler (server file); this pairs them exactly as proposal-ledger.functions.ts does,
// and the wiring test pins that file to these same pairs.
type Fn = { handler: (context: never, data: never) => Promise<unknown>; validator: (input: never) => unknown };
const fns = {
  boardValueSoFar: { handler: server.ledgerHandlers.boardValueSoFar, validator: ledgerBoardInput },
  firmValueSoFar: { handler: server.ledgerHandlers.firmValueSoFar, validator: ledgerProfileInput },
  recordProposalStep: { handler: server.ledgerHandlers.recordProposalStep, validator: ledgerStepInput },
  removeProposalStep: { handler: server.ledgerHandlers.removeProposalStep, validator: ledgerStepInput },
  setProposalValue: { handler: server.ledgerHandlers.setProposalValue, validator: ledgerValueInput },
  noteProposalShown: { handler: server.ledgerHandlers.noteProposalShown, validator: ledgerShownInput },
};
let db: FakeLedger;

/** Calls a server function the way the framework does: validate the input, then run the handler as that person. */
async function call<T>(fn: unknown, who: PersonKey, input: Record<string, unknown>): Promise<T> {
  const target = fn as Fn;
  const person = PEOPLE[who];
  return (await target.handler({ supabase: db.as(person.userId), userId: person.userId } as never, target.validator({ profile_id: person.profileId, ...input } as never) as never)) as T;
}

const status = async (work: Promise<unknown>): Promise<number | "ok"> => {
  try {
    await work;
    return "ok";
  } catch (thrown) {
    if (thrown instanceof Response) return thrown.status;
    throw thrown;
  }
};

const ledgerRows = (engagementId?: string) => db.rows("proposal_ledger").filter((row) => !engagementId || row["engagement_id"] === engagementId);
const adminActor = () => db.admin() as never;
const actorOf = (who: PersonKey) => ({ userDb: db.as(PEOPLE[who].userId), admin: db.admin(), profile: { id: PEOPLE[who].profileId, org_id: who === "outsider" ? OTHER_ORG : ORG, role: PEOPLE[who].role } }) as never;
const draft = (sourced = 7): ProposalDraft =>
  ({
    sections: Array.from({ length: 9 }, (_, index) => ({ key: `s${index}`, heading: "h", body: "b", status: index < sourced ? "draft" : "gap", sources: index < sourced ? [{ kind: "structure", boardId: SHARED_BOARD, boardTitle: "t" }] : [], flags: [] })),
    questions: [{ text: "q1", fallback: "f" }, { text: "q2", fallback: "f" }, { text: "q3", fallback: "f" }],
    checks: { names: "passed", blocked: 0, figuresRemoved: 0, newFacts: 0 },
    precedentIds: [],
    createdAt: "2026-11-10T09:30:00.000Z",
  }) as unknown as ProposalDraft;

/** A proposal started on a board: a brief and one draft, written the way the server paths write them. */
async function start(board: string, item = uuid(13)) {
  await server.recordBriefReceived(adminActor(), { orgId: ORG, engagementId: board, now: new Date("2026-11-08T10:00:00Z") });
  await server.recordDraftCompleted(adminActor(), { orgId: ORG, engagementId: board, itemId: item, draft: draft() });
}

beforeEach(() => {
  db = firm();
  h.db = db;
});

const TODAY = new Date().toISOString().slice(0, 10);
const ROLES: PersonKey[] = ["admin", "lead", "owner", "editor", "nonMember", "coach", "guest", "outsider"];

describe("each role, for every server function", () => {
  beforeEach(async () => {
    await start(SHARED_BOARD);
    await start(UNSHARED_BOARD);
    db.rows("proposal_ledger_values").push({ engagement_id: SHARED_BOARD, org_id: ORG, amount: 380_000, currency: "USD" }, { engagement_id: UNSHARED_BOARD, org_id: ORG, amount: 90_000, currency: "USD" });
  });

  it("boardValueSoFar on a shared board: owner and partners see rows; value reaches admins and leads only", async () => {
    const seen: Record<string, unknown> = {};
    for (const who of ROLES) {
      const result = await status(
        call<BoardValueSoFar>(fns.boardValueSoFar, who, { engagement_id: SHARED_BOARD }).then((view) => {
          seen[who] = [view.access, view.rows.length, "value" in view ? view.value : "no value key"];
        }),
      );
      if (result !== "ok") seen[who] = result;
    }
    expect(seen).toEqual({
      admin: ["partner", 2, { amount: 380_000, currency: "USD" }],
      lead: ["partner", 2, { amount: 380_000, currency: "USD" }],
      owner: ["owner", 2, "no value key"],
      editor: ["none", 0, "no value key"],
      nonMember: ["none", 0, "no value key"],
      coach: 403,
      guest: 403,
      outsider: ["none", 0, "no value key"],
    });
  });

  it("boardValueSoFar on an unshared board: its owner and an admin who can edit it are let in, and an em owner sees no value anywhere", async () => {
    const seen: Record<string, unknown> = {};
    for (const who of ROLES) {
      const result = await status(
        call<BoardValueSoFar>(fns.boardValueSoFar, who, { engagement_id: UNSHARED_BOARD }).then((view) => {
          seen[who] = [view.access, view.rows.length, view.canSetValue];
          if (who === "admin") expect(view.value, "the admin who can edit it reads the value back").toEqual({ amount: 90_000, currency: "USD" });
          else expect(JSON.stringify(view), `${who} gets no amount`).not.toMatch(/90000|amount/);
        }),
      );
      if (result !== "ok") seen[who] = result;
    }
    expect(seen).toEqual({
      // The admin can edit the board, so may set its value and reads its two rows (20261119130000).
      admin: ["partner", 2, true],
      lead: ["none", 0, false],
      owner: ["owner", 2, false],
      editor: ["none", 0, false],
      nonMember: ["none", 0, false],
      coach: 403,
      guest: 403,
      outsider: ["none", 0, false],
    });
  });

  it("firmValueSoFar: admins and leads only", async () => {
    const seen: Record<string, unknown> = {};
    for (const who of ROLES) seen[who] = await status(call<FirmValueSoFar>(fns.firmValueSoFar, who, {}));
    expect(seen).toEqual({ admin: "ok", lead: "ok", owner: 403, editor: 403, nonMember: 403, coach: 403, guest: 403, outsider: "ok" });
    // The outsider is an admin of another workspace: allowed in, and sees nothing of this one.
    const theirs = await call<FirmValueSoFar>(fns.firmValueSoFar, "outsider", {});
    expect(theirs.rows).toEqual([]);
    expect(theirs.figures.empty).toBe(true);
  });

  it("recordProposalStep: the owner and editors of the board; nobody else writes", async () => {
    const seen: Record<string, unknown> = {};
    for (const who of ROLES) {
      const before = ledgerRows().length;
      seen[who] = await status(call<StepResult>(fns.recordProposalStep, who, { engagement_id: SHARED_BOARD, kind: "questions_sent", date: TODAY }));
      if (seen[who] !== "ok") expect(ledgerRows().length, `${who} wrote nothing`).toBe(before);
    }
    expect(seen).toEqual({ admin: 403, lead: 403, owner: "ok", editor: "ok", nonMember: 403, coach: 403, guest: 403, outsider: 404 });
    expect(ledgerRows(SHARED_BOARD).filter((row) => row["kind"] === "questions_sent")).toHaveLength(1);
  });

  it("removeProposalStep: the same people", async () => {
    const seen: Record<string, unknown> = {};
    for (const who of ROLES) seen[who] = await status(call(fns.removeProposalStep, who, { engagement_id: SHARED_BOARD, kind: "brief_received" }));
    expect(seen).toEqual({ admin: 403, lead: 403, owner: "ok", editor: "ok", nonMember: 403, coach: 403, guest: 403, outsider: 404 });
  });

  it("setProposalValue: admins and leads only, never an em owner", async () => {
    const seen: Record<string, unknown> = {};
    for (const who of ROLES) seen[who] = await status(call<ValueResult>(fns.setProposalValue, who, { engagement_id: SHARED_BOARD, amount_text: "$400k", currency: "USD" }));
    expect(seen).toEqual({ admin: "ok", lead: "ok", owner: 403, editor: 403, nonMember: 403, coach: 403, guest: 403, outsider: 404 });
    expect(db.rows("proposal_ledger_values").find((row) => row["engagement_id"] === SHARED_BOARD)).toMatchObject({ amount: 400_000, currency: "USD" });
  });

  it("setProposalValue on an unshared board: only an admin or lead who is on it", async () => {
    expect(await status(call(fns.setProposalValue, "admin", { engagement_id: UNSHARED_BOARD, amount_text: "120k", currency: "GBP" }))).toBe("ok");
    expect(await status(call(fns.setProposalValue, "lead", { engagement_id: UNSHARED_BOARD, amount_text: "120k", currency: "GBP" }))).toBe(403);
    expect(await status(call(fns.setProposalValue, "owner", { engagement_id: UNSHARED_BOARD, amount_text: "120k", currency: "GBP" }))).toBe(403);
  });

  it("noteProposalShown: the owner and editors of the board", async () => {
    db.rows("client_showings").push({ engagement_id: SHARED_BOARD, work_item_id: PROPOSAL_ITEM, shown_on: "2026-11-12" });
    const seen: Record<string, unknown> = {};
    for (const who of ROLES) seen[who] = await status(call(fns.noteProposalShown, who, { engagement_id: SHARED_BOARD, item_id: PROPOSAL_ITEM }));
    expect(seen).toEqual({ admin: 403, lead: 403, owner: "ok", editor: "ok", nonMember: 403, coach: 403, guest: 403, outsider: 404 });
    expect(ledgerRows(SHARED_BOARD).filter((row) => row["kind"] === "sent_to_client")).toHaveLength(1);
  });

  it("a deactivated person and a person in a workspace that is not a company are refused everywhere", async () => {
    db.rows("profiles").find((row) => row["id"] === PEOPLE.editor.profileId)!["deactivated_at"] = "2026-11-01T00:00:00Z";
    expect(await status(call(fns.boardValueSoFar, "editor", { engagement_id: SHARED_BOARD }))).toBe(403);
    db.rows("orgs").find((row) => row["id"] === ORG)!["settings"] = { type: "personal" };
    for (const fn of [fns.boardValueSoFar, fns.recordProposalStep, fns.setProposalValue, fns.removeProposalStep]) {
      expect(await status(call(fn, "admin", { engagement_id: SHARED_BOARD, kind: "won", date: TODAY, amount_text: "1k", currency: "USD" }))).toBe(403);
    }
    expect(await status(call(fns.firmValueSoFar, "admin", {}))).toBe(403);
  });
});

describe("direct calls that skip the screen", () => {
  beforeEach(async () => {
    await start(SHARED_BOARD);
  });

  it("refuses another workspace's board and writes nothing", async () => {
    const before = ledgerRows().length;
    for (const fn of [fns.recordProposalStep, fns.removeProposalStep, fns.setProposalValue, fns.noteProposalShown]) {
      expect(await status(call(fn, "owner", { engagement_id: OTHER_ORG_BOARD, kind: "won", date: TODAY, amount_text: "1k", currency: "USD", item_id: PROPOSAL_ITEM }))).not.toBe("ok");
      expect(await status(call(fn, "admin", { engagement_id: OTHER_ORG_BOARD, kind: "won", date: TODAY, amount_text: "1k", currency: "USD", item_id: PROPOSAL_ITEM }))).toBe(404);
    }
    expect((await call<BoardValueSoFar>(fns.boardValueSoFar, "admin", { engagement_id: OTHER_ORG_BOARD })).access).toBe("none");
    expect(ledgerRows().length).toBe(before);
    expect(db.rows("proposal_ledger_values")).toEqual([]);
  });

  it("the outsider cannot read or write this workspace's board by id", async () => {
    expect(await status(call(fns.recordProposalStep, "outsider", { engagement_id: SHARED_BOARD, kind: "won", date: TODAY }))).toBe(404);
    expect((await call<BoardValueSoFar>(fns.boardValueSoFar, "outsider", { engagement_id: SHARED_BOARD })).rows).toEqual([]);
    // Even a direct read with their own client returns nothing, as the read rule would.
    const direct = await db.as(PEOPLE.outsider.userId).from("proposal_ledger").select("*").eq("engagement_id", SHARED_BOARD);
    expect(direct.data).toEqual([]);
  });

  it("refuses a board id that is not an id before anything runs", () => {
    for (const fn of [fns.boardValueSoFar, fns.recordProposalStep, fns.setProposalValue, fns.removeProposalStep, fns.noteProposalShown]) {
      expect(() => (fn as unknown as Fn).validator({ engagement_id: "'; drop table proposal_ledger; --" } as never)).toThrow();
      expect(() => (fn as unknown as Fn).validator({} as never)).toThrow();
    }
  });

  it("refuses a future date in plain words and writes nothing", async () => {
    const before = ledgerRows().length;
    const result = await call<StepResult>(fns.recordProposalStep, "owner", { engagement_id: SHARED_BOARD, kind: "sent_to_client", date: "2099-01-01" });
    expect(result).toEqual({ ok: false, problem: "Pick today or an earlier date." });
    for (const date of ["", "tomorrow", "2026-02-31", undefined]) expect(await call<StepResult>(fns.recordProposalStep, "owner", { engagement_id: SHARED_BOARD, kind: "sent_to_client", date })).toMatchObject({ ok: false });
    expect(ledgerRows().length).toBe(before);
  });

  it("refuses a second outcome in plain words, and keeps the first", async () => {
    expect(await call<StepResult>(fns.recordProposalStep, "owner", { engagement_id: SHARED_BOARD, kind: "won", date: "2026-11-14" })).toMatchObject({ ok: true });
    expect(await call<StepResult>(fns.recordProposalStep, "editor", { engagement_id: SHARED_BOARD, kind: "lost", date: "2026-11-15" })).toEqual({
      ok: false,
      problem: "This proposal is already marked won. Remove that before marking it lost.",
    });
    expect(ledgerRows(SHARED_BOARD).filter((row) => row["kind"] === "won" || row["kind"] === "lost").map((row) => [row["kind"], row["occurred_at"]])).toEqual([["won", "2026-11-14T12:00:00.000Z"]]);
    // Removing the outcome is the way to change it.
    expect(await call(fns.removeProposalStep, "owner", { engagement_id: SHARED_BOARD, kind: "won" })).toEqual({ ok: true });
    expect(await call<StepResult>(fns.recordProposalStep, "owner", { engagement_id: SHARED_BOARD, kind: "lost", date: "2026-11-15" })).toMatchObject({ ok: true });
  });

  it("refuses a second outcome that arrives at the same moment as the first", async () => {
    // Both at once, past the gate (the gate is covered above; two gates started together load the real admin
    // client under the test runner instead of the mocked one, which is a test-runner quirk and not the code).
    const [a, b] = await Promise.all([
      server.recordProposalStep(actorOf("owner"), { engagementId: SHARED_BOARD, kind: "won", date: "2026-11-14" }),
      server.recordProposalStep(actorOf("editor"), { engagementId: SHARED_BOARD, kind: "lost", date: "2026-11-14" }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(ledgerRows(SHARED_BOARD).filter((row) => row["kind"] === "won" || row["kind"] === "lost")).toHaveLength(1);
  });

  it("correcting a date updates the one row, and a double click writes one row", async () => {
    const first = await call<StepResult>(fns.recordProposalStep, "owner", { engagement_id: SHARED_BOARD, kind: "questions_sent", date: "2026-11-11" });
    const second = await call<StepResult>(fns.recordProposalStep, "owner", { engagement_id: SHARED_BOARD, kind: "questions_sent", date: "2026-11-09" });
    expect(first.ok && second.ok && first.row.id === second.row.id).toBe(true);
    const twice = await Promise.all([1, 2].map(() => server.recordProposalStep(actorOf("owner"), { engagementId: SHARED_BOARD, kind: "answers_received", date: "2026-11-12" })));
    expect(twice.every((result) => result.ok)).toBe(true);
    const rows = ledgerRows(SHARED_BOARD);
    expect(rows.filter((row) => row["kind"] === "questions_sent").map((row) => row["occurred_at"])).toEqual(["2026-11-09T12:00:00.000Z"]);
    expect(rows.filter((row) => row["kind"] === "answers_received")).toHaveLength(1);
    // The brief date written automatically can be corrected the same way.
    await call<StepResult>(fns.recordProposalStep, "owner", { engagement_id: SHARED_BOARD, kind: "brief_received", date: "2026-11-03" });
    expect(rows.filter((row) => row["kind"] === "brief_received").map((row) => row["occurred_at"])).toEqual(["2026-11-03T12:00:00.000Z"]);
  });

  it("refuses machine kinds and unknown kinds by hand", async () => {
    const before = ledgerRows().length;
    for (const kind of ["draft_completed", "red_pen_run", "", "paid", "WON"]) {
      expect(await call<StepResult>(fns.recordProposalStep, "owner", { engagement_id: SHARED_BOARD, kind, date: TODAY })).toEqual({ ok: false, problem: LEDGER_COPY.unknownStep });
      expect(await call(fns.removeProposalStep, "owner", { engagement_id: SHARED_BOARD, kind })).toEqual({ ok: false, problem: LEDGER_COPY.unknownStep });
    }
    expect(ledgerRows().length).toBe(before);
  });

  it("needs a proposal on the board before any later step, but lets the brief date open one", async () => {
    expect(await call<StepResult>(fns.recordProposalStep, "admin", { engagement_id: ADMIN_OWN_UNSHARED, kind: "won", date: TODAY })).toEqual({ ok: false, problem: LEDGER_COPY.needBrief });
    expect(await call<ValueResult>(fns.setProposalValue, "admin", { engagement_id: ADMIN_OWN_UNSHARED, amount_text: "1k", currency: "USD" })).toEqual({ ok: false, problem: LEDGER_COPY.notProposal });
    expect(await call<StepResult>(fns.recordProposalStep, "admin", { engagement_id: ADMIN_OWN_UNSHARED, kind: "brief_received", date: TODAY })).toMatchObject({ ok: true });
    expect(await call<StepResult>(fns.recordProposalStep, "admin", { engagement_id: ADMIN_OWN_UNSHARED, kind: "won", date: TODAY })).toMatchObject({ ok: true });
  });

  it("refuses a negative or malformed amount and a currency outside the list, and stores nothing", async () => {
    for (const [amount_text, currency] of [["-5000", "USD"], ["", "USD"], ["$300k to $350k", "USD"], ["lots", "USD"], ["380k", "JPY"], ["380k", ""], ["£380k", "USD"], ["$45k per month", "USD"], ["1e99", "USD"]]) {
      expect(await call<ValueResult>(fns.setProposalValue, "admin", { engagement_id: SHARED_BOARD, amount_text, currency }), `${amount_text} ${currency}`).toMatchObject({ ok: false });
    }
    expect(db.rows("proposal_ledger_values")).toEqual([]);
  });

  it("keeps one value per proposal, and removes it when asked", async () => {
    await call(fns.setProposalValue, "admin", { engagement_id: SHARED_BOARD, amount_text: "380k", currency: "USD" });
    expect(await call<ValueResult>(fns.setProposalValue, "lead", { engagement_id: SHARED_BOARD, amount_text: "£410,000", currency: "GBP" })).toEqual({ ok: true, value: { amount: 410_000, currency: "GBP" } });
    expect(db.rows("proposal_ledger_values")).toHaveLength(1);
    expect(await call<ValueResult>(fns.setProposalValue, "admin", { engagement_id: SHARED_BOARD, clear: true })).toEqual({ ok: true, value: null });
    expect(db.rows("proposal_ledger_values")).toEqual([]);
  });

  it("a signed-in person's own client cannot write either table", async () => {
    const mine = db.as(PEOPLE.admin.userId);
    expect((await mine.from("proposal_ledger").insert({ org_id: ORG, engagement_id: SHARED_BOARD, kind: "won" })).error?.code).toBe("42501");
    expect((await mine.from("proposal_ledger_values").upsert({ org_id: ORG, engagement_id: SHARED_BOARD, amount: 1, currency: "USD" })).error?.code).toBe("42501");
    expect((await mine.from("proposal_ledger").delete().eq("engagement_id", SHARED_BOARD)).error?.code).toBe("42501");
  });
});

describe("machine rows", () => {
  it("writes one draft row with counts taken from the saved draft, and a retry of the same draft writes nothing more", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) await server.ledgerAfterDraft(adminActor(), { orgId: ORG, engagementId: UNSHARED_BOARD, itemId: DRAFT_ITEM, draft: draft(7) });
    const rows = ledgerRows(UNSHARED_BOARD);
    expect(rows.map((row) => row["kind"]).sort()).toEqual(["brief_received", "draft_completed"]);
    expect(rows.find((row) => row["kind"] === "draft_completed")).toMatchObject({ source_ref: DRAFT_ITEM, sections_total: 9, sections_sourced: 7, questions_prepared: 3, occurred_at: "2026-11-10T09:30:00.000Z", org_id: ORG });
  });

  it("a second draft on the same board is its own row, and never moves the brief date", async () => {
    await server.ledgerAfterDraft(adminActor(), { orgId: ORG, engagementId: UNSHARED_BOARD, itemId: DRAFT_ITEM, draft: draft(7) });
    const brief = ledgerRows(UNSHARED_BOARD).find((row) => row["kind"] === "brief_received")!["occurred_at"];
    await server.ledgerAfterDraft(adminActor(), { orgId: ORG, engagementId: UNSHARED_BOARD, itemId: uuid(13), draft: draft(9) });
    expect(ledgerRows(UNSHARED_BOARD).filter((row) => row["kind"] === "draft_completed")).toHaveLength(2);
    expect(ledgerRows(UNSHARED_BOARD).filter((row) => row["kind"] === "brief_received").map((row) => row["occurred_at"])).toEqual([brief]);
  });

  it("never dates a draft in the future, whatever the draft says", async () => {
    await server.recordDraftCompleted(adminActor(), { orgId: ORG, engagementId: UNSHARED_BOARD, itemId: DRAFT_ITEM, draft: { ...draft(), createdAt: "2999-01-01T00:00:00.000Z" } });
    await server.recordDraftCompleted(adminActor(), { orgId: ORG, engagementId: SHARED_BOARD, itemId: uuid(13), draft: { ...draft(), createdAt: "not a date" } });
    for (const row of ledgerRows()) expect(Date.parse(String(row["occurred_at"]))).toBeLessThanOrEqual(Date.now());
  });

  it("records the brief date when a person who can edit the board sends a brief, once", async () => {
    const actor = (who: PersonKey) => ({ userDb: db.as(PEOPLE[who].userId), admin: db.admin(), profile: { id: PEOPLE[who].profileId, org_id: who === "outsider" ? OTHER_ORG : ORG, role: PEOPLE[who].role } }) as never;
    await server.ledgerAfterBrief(actor("owner"), { engagementId: UNSHARED_BOARD, hasBrief: false });
    await server.ledgerAfterBrief(actor("nonMember"), { engagementId: UNSHARED_BOARD, hasBrief: true });
    await server.ledgerAfterBrief(actor("outsider"), { engagementId: UNSHARED_BOARD, hasBrief: true });
    expect(ledgerRows(UNSHARED_BOARD)).toEqual([]);
    await server.ledgerAfterBrief(actor("owner"), { engagementId: UNSHARED_BOARD, hasBrief: true });
    await server.ledgerAfterBrief(actor("editor"), { engagementId: UNSHARED_BOARD, hasBrief: true });
    expect(ledgerRows(UNSHARED_BOARD).map((row) => row["kind"])).toEqual(["brief_received"]);
  });

  it("writes one Red pen row per run, only for a proposal deliverable on a proposal board", async () => {
    const actor = { userDb: db.as(PEOPLE.owner.userId), admin: db.admin(), profile: { id: PEOPLE.owner.profileId, org_id: ORG, role: "em" } } as never;
    const claims = [{ grade: "unsupported" }, { grade: "unsupported" }, { grade: "weak" }, { grade: "sourced" }] as never;
    const run = uuid(14);
    // No proposal started on the board yet: nothing is written.
    await server.ledgerAfterRedPen(actor, { engagementId: SHARED_BOARD, itemId: PROPOSAL_ITEM, runId: run, claims });
    expect(ledgerRows()).toEqual([]);
    await start(SHARED_BOARD);
    // A deck on a proposal board is not the proposal.
    await server.ledgerAfterRedPen(actor, { engagementId: SHARED_BOARD, itemId: DECK_ITEM, runId: uuid(14), claims });
    expect(ledgerRows().filter((row) => row["kind"] === "red_pen_run")).toEqual([]);
    for (let attempt = 0; attempt < 3; attempt += 1) await server.ledgerAfterRedPen(actor, { engagementId: SHARED_BOARD, itemId: PROPOSAL_ITEM, runId: run, claims });
    const runs = ledgerRows().filter((row) => row["kind"] === "red_pen_run");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ source_ref: run, claims_unsupported: 2, sections_total: null, engagement_id: SHARED_BOARD });
  });

  it("copies the stored Shown to client date of a proposal, once, and ignores anything else", async () => {
    await start(SHARED_BOARD);
    // No mark stored: a call that claims one writes nothing.
    expect(await call(fns.noteProposalShown, "owner", { engagement_id: SHARED_BOARD, item_id: PROPOSAL_ITEM })).toEqual({ recorded: false });
    db.rows("client_showings").push({ engagement_id: SHARED_BOARD, work_item_id: DECK_ITEM, shown_on: "2026-11-11" }, { engagement_id: SHARED_BOARD, work_item_id: PROPOSAL_ITEM, shown_on: "2026-11-13" }, { engagement_id: SHARED_BOARD, work_item_id: PROPOSAL_ITEM, shown_on: "2026-11-12" });
    expect(await call(fns.noteProposalShown, "owner", { engagement_id: SHARED_BOARD, item_id: DECK_ITEM })).toEqual({ recorded: false });
    expect(await call(fns.noteProposalShown, "owner", { engagement_id: SHARED_BOARD, item_id: PROPOSAL_ITEM })).toEqual({ recorded: true });
    expect(await call(fns.noteProposalShown, "editor", { engagement_id: SHARED_BOARD, item_id: PROPOSAL_ITEM })).toEqual({ recorded: false });
    expect(ledgerRows(SHARED_BOARD).filter((row) => row["kind"] === "sent_to_client").map((row) => row["occurred_at"])).toEqual(["2026-11-12T12:00:00.000Z"]);
  });
});

describe("a ledger failure never fails or holds the work it records", () => {
  it("returns without throwing when the write errors or the network drops", async () => {
    for (const how of ["error", "throw"] as const) {
      db = firm();
      h.db = db;
      db.failOn("admin", "proposal_ledger", "insert", how);
      await expect(server.ledgerAfterDraft(adminActor(), { orgId: ORG, engagementId: UNSHARED_BOARD, itemId: DRAFT_ITEM, draft: draft() })).resolves.toBeUndefined();
      const actor = { userDb: db.as(PEOPLE.owner.userId), admin: db.admin(), profile: { id: PEOPLE.owner.profileId, org_id: ORG, role: "em" } } as never;
      await expect(server.ledgerAfterBrief(actor, { engagementId: UNSHARED_BOARD, hasBrief: true })).resolves.toBeUndefined();
      await expect(server.ledgerAfterRedPen(actor, { engagementId: UNSHARED_BOARD, itemId: DRAFT_ITEM, runId: uuid(14), claims: [] })).resolves.toBeUndefined();
      expect(ledgerRows()).toEqual([]);
    }
  });

  it("returns without throwing when the work itself throws at once", async () => {
    await expect(server.detachLedger(() => { throw new Error("sync"); })).resolves.toBeUndefined();
    await expect(server.detachLedger(() => Promise.reject(new Error("async")))).resolves.toBeUndefined();
  });

  it("waits no longer than the cap for a write that never returns", async () => {
    vi.useFakeTimers();
    try {
      db.failOn("admin", "proposal_ledger", "insert", "hang");
      let done = false;
      void server.ledgerAfterDraft(adminActor(), { orgId: ORG, engagementId: UNSHARED_BOARD, itemId: DRAFT_ITEM, draft: draft() }).then(() => {
        done = true;
      });
      await vi.advanceTimersByTimeAsync(server.LEDGER_WAIT_MS - 1);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      expect(done).toBe(true);
      expect(server.LEDGER_WAIT_MS).toBeLessThanOrEqual(2_000);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("valueSoFar reads with the person's own client, so the database decides the rows", () => {
  beforeEach(async () => {
    await start(SHARED_BOARD);
    await start(UNSHARED_BOARD, DRAFT_ITEM);
    await start(ADMIN_OWN_UNSHARED);
    for (const board of [SHARED_BOARD, UNSHARED_BOARD, ADMIN_OWN_UNSHARED]) {
      const { error } = await db.admin().from("proposal_ledger").insert({ org_id: ORG, engagement_id: board, kind: "won", occurred_at: "2026-11-14T12:00:00.000Z" });
      expect(error).toBeNull();
    }
    db.rows("proposal_ledger_values").push({ engagement_id: SHARED_BOARD, org_id: ORG, amount: 380_000, currency: "USD" }, { engagement_id: UNSHARED_BOARD, org_id: ORG, amount: 900_000, currency: "USD" }, { engagement_id: ADMIN_OWN_UNSHARED, org_id: ORG, amount: 70_000, currency: "GBP" });
    db.calls = [];
  });

  it("an unshared board's rows never reach the firm card of an admin who does not own it", async () => {
    const view = await call<FirmValueSoFar>(fns.firmValueSoFar, "lead", {});
    expect(new Set(view.rows.map((row) => row.engagement_id))).toEqual(new Set([SHARED_BOARD]));
    expect(view.figures.proposals.value).toBe(1);
    expect(view.figures.valueWon).toEqual([expect.objectContaining({ currency: "USD", amount: 380_000, boardIds: [SHARED_BOARD] })]);
    expect(JSON.stringify(view)).not.toContain(UNSHARED_BOARD);
    expect(JSON.stringify(view)).not.toMatch(/900000|70000/);
  });

  it("an admin's own unshared board is not counted for the firm either, though the database shows it to them", async () => {
    const direct = await db.as(PEOPLE.admin.userId).from("proposal_ledger").select("*").eq("org_id", ORG);
    // The database also shows them the unshared board they can edit; the firm's figure counts neither.
    expect(new Set((direct.data as { engagement_id: string }[]).map((row) => row.engagement_id))).toEqual(new Set([SHARED_BOARD, ADMIN_OWN_UNSHARED, UNSHARED_BOARD]));
    const view = await call<FirmValueSoFar>(fns.firmValueSoFar, "admin", {});
    expect(new Set(view.rows.map((row) => row.engagement_id))).toEqual(new Set([SHARED_BOARD]));
    expect(view.figures.valueWon!.map((value) => value.currency)).toEqual(["USD"]);
    expect(view.figures.valueWon).toEqual([expect.objectContaining({ currency: "USD", amount: 380_000, boardIds: [SHARED_BOARD] })]);
    expect(JSON.stringify(view)).not.toContain(UNSHARED_BOARD);
    expect(JSON.stringify(view)).not.toMatch(/900000|70000/);
    // On the board itself they still see it, as its owner.
    const own = await call<BoardValueSoFar>(fns.boardValueSoFar, "admin", { engagement_id: ADMIN_OWN_UNSHARED });
    expect([own.access, own.rows.length, own.value]).toEqual(["owner", 3, { amount: 70_000, currency: "GBP" }]);
  });

  it("turning sharing off removes the board from the firm card at the next read, and archiving does too", async () => {
    db.rows("engagements").find((row) => row["id"] === SHARED_BOARD)!["shared_with_firm"] = false;
    expect((await call<FirmValueSoFar>(fns.firmValueSoFar, "lead", {})).rows).toEqual([]);
    expect((await call<BoardValueSoFar>(fns.boardValueSoFar, "lead", { engagement_id: SHARED_BOARD })).access).toBe("none");
    Object.assign(db.rows("engagements").find((row) => row["id"] === SHARED_BOARD)!, { shared_with_firm: true, archived_at: "2026-11-18T00:00:00Z" });
    expect((await call<FirmValueSoFar>(fns.firmValueSoFar, "lead", {})).rows).toEqual([]);
  });

  it("never opens the ledger with the admin client when reading", async () => {
    await call(fns.firmValueSoFar, "admin", {});
    await call(fns.firmValueSoFar, "lead", {});
    for (const who of ["admin", "lead", "owner", "editor", "nonMember", "outsider"] as const) {
      await call(fns.boardValueSoFar, who, { engagement_id: SHARED_BOARD });
      await call(fns.boardValueSoFar, who, { engagement_id: UNSHARED_BOARD });
    }
    const adminLedgerReads = db.calls.filter((entry) => entry.client === "admin" && entry.table.startsWith("proposal_ledger"));
    expect(adminLedgerReads).toEqual([]);
    // The only tables the admin client opened were the gate's own: who the caller is and what kind of workspace.
    expect([...new Set(db.calls.filter((entry) => entry.client === "admin").map((entry) => entry.table))].sort()).toEqual(["orgs", "profiles"]);
    expect(db.calls.filter((entry) => entry.client === "user" && entry.table === "proposal_ledger").length).toBeGreaterThan(0);
    expect(db.calls.some((entry) => entry.table === "proposal_ledger" && entry.op !== "select")).toBe(false);
  });

  it("a reader the database shows nothing gets no ledger read at all, and no value read without the role", async () => {
    await call(fns.boardValueSoFar, "editor", { engagement_id: SHARED_BOARD });
    expect(db.calls.filter((entry) => entry.table.startsWith("proposal_ledger"))).toEqual([]);
    await call(fns.boardValueSoFar, "owner", { engagement_id: SHARED_BOARD });
    expect(db.calls.filter((entry) => entry.table === "proposal_ledger_values")).toEqual([]);
  });

  it("returns each figure with its row ids, links a draft row to the draft, and names no person", async () => {
    const view = await call<BoardValueSoFar>(fns.boardValueSoFar, "owner", { engagement_id: UNSHARED_BOARD });
    const ids = new Set(view.rows.map((row) => row.id));
    for (const figure of [view.figures.proposals, view.figures.briefToDraft, view.figures.sourced, view.figures.questionsPrepared, view.figures.won]) {
      expect(figure.rowIds.length).toBeGreaterThan(0);
      for (const id of figure.rowIds) expect(ids.has(id)).toBe(true);
    }
    const draftRow = view.rows.find((row) => row.kind === "draft_completed")!;
    expect(view.sources[draftRow.id]).toEqual({ itemId: DRAFT_ITEM, title: "Proposal draft: Marrowfield", as: "draft" });
    const text = JSON.stringify(view);
    for (const who of Object.values(PEOPLE)) {
      expect(text).not.toContain(who.profileId);
      expect(text).not.toContain(who.userId);
    }
    expect(text).not.toMatch(/owner_id|profile|display_name|email/);
  });

  it("fails loudly when the read fails, instead of showing an empty line", async () => {
    db.failOn("user", "proposal_ledger", "select", "error");
    expect(await status(call(fns.boardValueSoFar, "owner", { engagement_id: SHARED_BOARD }))).toBe(500);
    expect(await status(call(fns.firmValueSoFar, "admin", {}))).toBe(500);
  });
});
