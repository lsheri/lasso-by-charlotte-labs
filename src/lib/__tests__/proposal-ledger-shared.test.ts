// 19 Nov, Firm Brain Build Spec step 9, the proposal ledger. The two spec checks: every number on the "value so far"
// line traces to ledger rows, and no number is grouped by person. Plus the pure rules: dates, amounts, counts, access.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { ProposalDraft } from "@/lib/proposal-draft-shared";
import {
  boardTimeline,
  canSeeLedgerValue,
  canSetLedgerValue,
  checkStepDate,
  draftLedgerCounts,
  formatLedgerAmount,
  HUMAN_KINDS,
  isHumanKind,
  latestToday,
  LEDGER_COLUMNS,
  LEDGER_COPY,
  LEDGER_CURRENCIES,
  LEDGER_KINDS,
  LEDGER_VALUE_COLUMNS,
  ledgerAccess,
  ledgerFigureLines,
  ledgerRowLine,
  parseLedgerAmount,
  redPenLedgerCount,
  stepInstant,
  valueSoFar,
  type LedgerKind,
  type LedgerRow,
  type LedgerValueRow,
  type ValueSoFar,
} from "@/lib/proposal-ledger-shared";
import { parseFee } from "@/lib/sow-terms-shared";

const B1 = "0000000b-0000-4000-8000-000000000001";
const B2 = "0000000b-0000-4000-8000-000000000002";
const B3 = "0000000b-0000-4000-8000-000000000003";
let n = 0;
const row = (engagement_id: string, kind: LedgerKind, day: string, over: Partial<LedgerRow> = {}): LedgerRow => {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    engagement_id,
    kind,
    occurred_at: `${day}T12:00:00.000Z`,
    source_ref: null,
    sections_total: null,
    sections_sourced: null,
    questions_prepared: null,
    claims_unsupported: null,
    ...over,
  };
};
const draftRow = (board: string, day: string, total: number, sourced: number, questions: number) =>
  row(board, "draft_completed", day, { source_ref: `0000000d-0000-4000-8000-${String(n + 1).padStart(12, "0")}`, sections_total: total, sections_sourced: sourced, questions_prepared: questions });
const runRow = (board: string, day: string, claims: number) => row(board, "red_pen_run", day, { source_ref: `0000000e-0000-4000-8000-${String(n + 1).padStart(12, "0")}`, claims_unsupported: claims });

/** Three proposals: B1 won with every step, B2 lost, B3 a brief and a draft only, with a second draft on B1. */
function ledger(): { rows: LedgerRow[]; values: LedgerValueRow[] } {
  const rows = [
    row(B1, "brief_received", "2026-11-02"),
    draftRow(B1, "2026-11-04", 9, 7, 5),
    draftRow(B1, "2026-11-09", 9, 9, 3),
    runRow(B1, "2026-11-05", 4),
    runRow(B1, "2026-11-06", 1),
    row(B1, "questions_sent", "2026-11-05"),
    row(B1, "answers_received", "2026-11-07"),
    row(B1, "sent_to_client", "2026-11-10"),
    row(B1, "won", "2026-11-14"),
    row(B2, "brief_received", "2026-11-03"),
    draftRow(B2, "2026-11-09", 9, 4, 6),
    runRow(B2, "2026-11-10", 2),
    row(B2, "questions_sent", "2026-11-10"),
    row(B2, "sent_to_client", "2026-11-12"),
    row(B2, "lost", "2026-11-16"),
    row(B3, "brief_received", "2026-11-11"),
    draftRow(B3, "2026-11-11", 8, 6, 4),
  ];
  return { rows, values: [{ engagement_id: B1, amount: 380_000, currency: "USD" }, { engagement_id: B2, amount: 90_000, currency: "GBP" }] };
}

/** Every traced figure in a result, by name, with the ids behind it. */
function traced(figures: ValueSoFar): [string, unknown, string[]][] {
  const out: [string, unknown, string[]][] = [];
  for (const key of ["proposals", "briefToDraft", "sourced", "questionsPrepared", "claimsCaught", "questionsSent", "answersBack", "sent", "won", "lost"] as const) {
    out.push([key, figures[key].value, figures[key].rowIds]);
  }
  for (const value of figures.valueWon ?? []) out.push([`valueWon-${value.currency}`, value.amount, value.rowIds]);
  return out;
}

describe("spec check 1: every number on the value so far line traces to ledger rows", () => {
  it("computes each figure from the rows", () => {
    const { rows, values } = ledger();
    const figures = valueSoFar(rows, values);
    expect(figures.empty).toBe(false);
    expect(figures.proposals.value).toBe(3);
    // Days from brief to first draft: 2, 6 and 0, so the median is 2.
    expect(figures.briefToDraft.value).toEqual({ days: 2, basis: "median", proposals: 3 });
    // First drafts only: 7 + 4 + 6 of 9 + 9 + 8. The redraft on B1 is not counted twice.
    expect(figures.sourced.value).toEqual({ sourced: 17, total: 26 });
    expect(figures.questionsPrepared.value).toBe(15);
    expect(figures.claimsCaught.value).toEqual({ claims: 7, runs: 3 });
    expect([figures.questionsSent.value, figures.answersBack.value, figures.sent.value, figures.won.value, figures.lost.value]).toEqual([2, 1, 2, 1, 1]);
    expect(figures.valueWon).toEqual([{ currency: "USD", amount: 380_000, rowIds: [rows[8]!.id], boardIds: [B1] }]);
  });

  it("returns every figure with row ids that exist, and recomputing from only those rows gives the same figure", () => {
    const { rows, values } = ledger();
    const figures = valueSoFar(rows, values);
    const known = new Set(rows.map((entry) => entry.id));
    for (const [name, value, rowIds] of traced(figures)) {
      expect(rowIds.length, `${name} has rows behind it`).toBeGreaterThan(0);
      for (const id of rowIds) expect(known.has(id), `${name} names a real row`).toBe(true);
      const again = valueSoFar(rows.filter((entry) => rowIds.includes(entry.id)), values);
      const match = traced(again).find(([key]) => key === name);
      expect(match?.[1], `${name} recomputed from its own rows`).toEqual(value);
      expect([...(match?.[2] ?? [])].sort(), `${name} keeps the same rows`).toEqual([...rowIds].sort());
    }
  });

  it("changes a figure or its row ids when any one row is removed", () => {
    const { rows, values } = ledger();
    const before = JSON.stringify(traced(valueSoFar(rows, values)));
    for (const gone of rows) {
      const after = JSON.stringify(traced(valueSoFar(rows.filter((entry) => entry !== gone), values)));
      expect(after, `removing ${gone.kind} on ${gone.engagement_id}`).not.toBe(before);
    }
  });

  it("holds for random ledgers too: no figure counts a row it does not name", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let round = 0; round < 40; round += 1) {
      const boards = [B1, B2, B3].slice(0, 1 + Math.floor(random() * 3));
      const rows: LedgerRow[] = [];
      for (const board of boards) {
        const day = (offset: number) => `2026-11-${String(1 + Math.floor(random() * 20) + offset).padStart(2, "0")}`;
        if (random() > 0.2) rows.push(row(board, "brief_received", day(0)));
        for (let d = Math.floor(random() * 3); d > 0; d -= 1) rows.push(draftRow(board, day(2), 9, Math.floor(random() * 10), Math.floor(random() * 7)));
        for (let r = Math.floor(random() * 3); r > 0; r -= 1) rows.push(runRow(board, day(3), Math.floor(random() * 6)));
        for (const kind of ["questions_sent", "answers_received", "sent_to_client"] as const) if (random() > 0.5) rows.push(row(board, kind, day(4)));
        if (random() > 0.5) rows.push(row(board, random() > 0.5 ? "won" : "lost", day(6)));
      }
      const values = boards.map((board, index) => ({ engagement_id: board, amount: 1_000 * (index + 1), currency: index === 1 ? "EUR" : "USD" }));
      const figures = valueSoFar(rows, values);
      for (const [name, value, rowIds] of traced(figures)) {
        const again = traced(valueSoFar(rows.filter((entry) => rowIds.includes(entry.id)), values)).find(([key]) => key === name);
        const nothing = rowIds.length === 0;
        if (nothing) continue;
        expect(again?.[1], `round ${round}: ${name}`).toEqual(value);
      }
      const named = new Set(traced(figures).flatMap(([, , rowIds]) => rowIds));
      for (const entry of rows) expect(named.has(entry.id), `round ${round}: ${entry.kind} is behind a figure`).toBe(true);
    }
  });

  it("never sums value across currencies, and counts value only for proposals that were won", () => {
    const rows = [row(B1, "brief_received", "2026-11-01"), row(B1, "won", "2026-11-05"), row(B2, "brief_received", "2026-11-01"), row(B2, "won", "2026-11-06"), row(B3, "brief_received", "2026-11-01"), row(B3, "lost", "2026-11-06")];
    const values = [{ engagement_id: B1, amount: 380_000, currency: "USD" }, { engagement_id: B2, amount: 45_000, currency: "GBP" }, { engagement_id: B3, amount: 999_999, currency: "USD" }];
    const won = valueSoFar(rows, values).valueWon!;
    expect(won.map((entry) => [entry.currency, entry.amount])).toEqual([["GBP", 45_000], ["USD", 380_000]]);
    expect(ledgerFigureLines(valueSoFar(rows, values), "firm").filter((line) => line.key.startsWith("valueWon")).map((line) => line.text)).toEqual(["Value won: GBP 45,000", "Value won: USD 380,000"]);
  });
});

describe("spec check 2: no number is grouped by person", () => {
  const PERSON_KEY = /profile|owner|user|actor|author|email|display_?name|person|member|marked_?by|created_?by|^by$/i;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /** personIdentifyingPaths for this payload: a person-like key anywhere, or an id that is not a ledger row, board or source id. */
  function personPaths(value: unknown, allowed: ReadonlySet<string>, path = "$"): string[] {
    if (Array.isArray(value)) return value.flatMap((entry, index) => personPaths(entry, allowed, `${path}[${index}]`));
    if (value && typeof value === "object") {
      return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => [...(PERSON_KEY.test(key) ? [`${path}.${key}`] : []), ...personPaths(entry, allowed, `${path}.${key}`)]);
    }
    return typeof value === "string" && UUID.test(value) && !allowed.has(value) ? [path] : [];
  }

  it("finds no person field and no id from outside the ledger in the figures", () => {
    const { rows, values } = ledger();
    const allowed = new Set(rows.flatMap((entry) => [entry.id, entry.engagement_id, entry.source_ref ?? ""]));
    expect(personPaths({ figures: valueSoFar(rows, values), rows, lines: ledgerFigureLines(valueSoFar(rows, values), "firm") }, allowed)).toEqual([]);
    // The scan itself catches a planted owner and a planted stranger id.
    expect(personPaths({ rows: [{ ...rows[0], owner_id: "x" }] }, allowed)).toEqual(["$.rows[0].owner_id"]);
    expect(personPaths({ who: "99999999-9999-4999-8999-999999999999" }, allowed)).toEqual(["$.who"]);
  });

  it("reads only columns that name no person, from tables that have none", () => {
    for (const columns of [LEDGER_COLUMNS, LEDGER_VALUE_COLUMNS]) for (const column of columns.split(", ")) expect(PERSON_KEY.test(column), column).toBe(false);
    const sql = readFileSync("supabase/migrations/20261119120000_s9_proposal_ledger.sql", "utf8");
    const tables = [...sql.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/g)];
    expect(tables.map((match) => match[1])).toEqual(["proposal_ledger", "proposal_ledger_values"]);
    for (const [, name, body] of tables) {
      const columns = body!.split("\n").map((line) => line.trim().split(" ")[0]!).filter((word) => /^[a-z_]+$/.test(word) && word !== "constraint");
      for (const column of columns) expect(PERSON_KEY.test(column), `${name}.${column}`).toBe(false);
      expect(body).not.toMatch(/references public\.profiles/);
    }
    const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
    const block = types.slice(types.indexOf("      proposal_ledger: {"), types.indexOf("      push_intents: {"));
    expect(block).not.toMatch(/profile|owner|marked_by|created_by|user_id/);
  });

  it("has no grouping by owner and no profiles read anywhere in the ledger code", () => {
    for (const file of ["src/lib/proposal-ledger-shared.ts", "src/lib/proposal-ledger.server.ts", "src/lib/proposal-ledger.functions.ts", "src/components/firm-brain/ProposalValueLine.tsx", "src/components/firm-brain/ProposalLedgerFigures.tsx", "src/components/firm/FirmProposalsCard.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/from\("profiles"\)|display_name|group by/i);
      expect(source, `${file}: no em dash`).not.toContain("\u2014");
    }
  });

  it("the migration keeps writes to the service role and reads behind explicit policies", () => {
    const sql = readFileSync("supabase/migrations/20261119120000_s9_proposal_ledger.sql", "utf8");
    expect(sql.match(/enable row level security/g)).toHaveLength(2);
    expect(sql).not.toMatch(/for (insert|update|delete|all)\b/);
    expect(sql).toContain("revoke all on table public.proposal_ledger from anon, authenticated");
    expect(sql).toContain("revoke all on table public.proposal_ledger_values from anon, authenticated");
    expect(sql).toContain("public.can_read_proposal_ledger(org_id, engagement_id, true)");
    expect(sql).not.toMatch(/drop table|drop column|alter column/i);
    expect(sql).not.toContain("\u2014");
  });
});

describe("what the line says", () => {
  it("says so plainly when there is nothing", () => {
    const figures = valueSoFar([], null);
    expect(figures.empty).toBe(true);
    expect(ledgerFigureLines(figures, "firm")).toEqual([]);
    expect(ledgerFigureLines(figures, "board")).toEqual([]);
    expect("valueWon" in figures).toBe(false);
    expect(LEDGER_COPY.empty).toMatch(/Nothing is recorded/);
  });

  it("shows one proposal's own facts without calling anything a median", () => {
    const rows = [row(B1, "brief_received", "2026-11-02"), draftRow(B1, "2026-11-05", 9, 7, 5), runRow(B1, "2026-11-06", 1)];
    const figures = valueSoFar(rows, null);
    expect(figures.briefToDraft.value).toEqual({ days: 3, basis: "one", proposals: 1 });
    const lines = ledgerFigureLines(figures, "board").map((line) => line.text);
    expect(lines).toEqual(["Brief to first draft: 3 days", "7 of 9 sections arrived with a source", "5 questions prepared for the lead", "1 unsupported claim flagged by Red pen, across 1 run"]);
    expect(lines.join(" ")).not.toMatch(/median/i);
    expect(ledgerFigureLines(figures, "firm").map((line) => line.text)).toContain("1 proposal started");
  });

  it("reads a same-day draft as the same day, a half-day median honestly, and leaves out a brief dated after its draft", () => {
    expect(ledgerFigureLines(valueSoFar([row(B1, "brief_received", "2026-11-05"), draftRow(B1, "2026-11-05", 9, 9, 3)], null), "board")[0]!.text).toBe("Brief to first draft: the same day");
    const two = [row(B1, "brief_received", "2026-11-01"), draftRow(B1, "2026-11-02", 9, 9, 3), row(B2, "brief_received", "2026-11-01"), draftRow(B2, "2026-11-03", 9, 9, 3)];
    expect(ledgerFigureLines(valueSoFar(two, null), "firm").find((line) => line.key === "briefToDraft")!.text).toBe("Median from brief to first draft: 1.5 days, across 2 proposals");
    const late = valueSoFar([row(B1, "brief_received", "2026-11-09"), draftRow(B1, "2026-11-05", 9, 9, 3)], null);
    expect(late.briefToDraft).toEqual({ value: null, rowIds: [] });
    expect(late.proposals.value).toBe(1);
  });

  it("gives no value key unless values are passed, so a reader without fees gets no amount at all", () => {
    const { rows, values } = ledger();
    expect(JSON.stringify(valueSoFar(rows, null))).not.toMatch(/valueWon|380000|amount/);
    expect(valueSoFar(rows, values).valueWon).toHaveLength(1);
  });

  it("describes each row in a trace by date, kind and its own counts", () => {
    expect(ledgerRowLine(draftRow(B1, "2026-11-04", 9, 7, 5))).toBe("4 Nov 2026 · First draft · 7 of 9 sections sourced · 5 questions");
    expect(ledgerRowLine(runRow(B1, "2026-11-05", 1))).toBe("5 Nov 2026 · Red pen run · 1 unsupported claim");
    expect(ledgerRowLine(row(B1, "won", "2026-11-14"))).toBe("14 Nov 2026 · Won");
  });

  it("lays one proposal's steps out in order, with the first draft and the outcome", () => {
    const { rows } = ledger();
    const timeline = boardTimeline(rows.filter((entry) => entry.engagement_id === B1));
    expect(timeline.steps.map((step) => [step.kind, step.date, step.editable])).toEqual([
      ["brief_received", "2026-11-02", true],
      ["draft_completed", "2026-11-04", false],
      ["questions_sent", "2026-11-05", true],
      ["answers_received", "2026-11-07", true],
      ["sent_to_client", "2026-11-10", true],
    ]);
    expect(timeline.outcome).toMatchObject({ kind: "won", date: "2026-11-14" });
    expect(boardTimeline([]).steps.every((step) => step.date === null)).toBe(true);
    expect(boardTimeline([]).outcome).toBeNull();
  });
});

describe("counts are taken in code from what was saved", () => {
  const section = (key: string, status: "draft" | "confirmed" | "gap", sources: number) => ({ key, heading: key, body: "x", status, sources: Array.from({ length: sources }, () => ({ kind: "structure", boardId: B1, boardTitle: "t" })), flags: [] });

  it("counts sections, sourced sections and questions from the draft", () => {
    const draft = { sections: [section("context", "draft", 2), section("objectives", "draft", 0), section("approach", "gap", 0), section("fee", "confirmed", 1)], questions: [{ text: "a", fallback: "b" }, { text: "c", fallback: "d" }] } as unknown as ProposalDraft;
    expect(draftLedgerCounts(draft)).toEqual({ sections_total: 4, sections_sourced: 2, questions_prepared: 2 });
  });

  it("never trusts a number the model wrote, and survives a malformed draft", () => {
    const lying = { sections: [section("context", "gap", 3)], questions: [], sections_sourced: 99, checks: { sourced: 50 } } as unknown as ProposalDraft;
    expect(draftLedgerCounts(lying)).toEqual({ sections_total: 1, sections_sourced: 0, questions_prepared: 0 });
    expect(draftLedgerCounts({ sections: null, questions: "junk" } as unknown as ProposalDraft)).toEqual({ sections_total: 0, sections_sourced: 0, questions_prepared: 0 });
  });

  it("counts unsupported claims from the stored grades", () => {
    const claim = (grade: string) => ({ grade }) as never;
    expect(redPenLedgerCount([claim("unsupported"), claim("weak"), claim("sourced"), claim("unsupported")])).toBe(2);
    expect(redPenLedgerCount([])).toBe(0);
  });
});

describe("dates a person enters", () => {
  const now = new Date("2026-11-19T10:00:00Z");

  it("accepts today and earlier, in any time zone's today", () => {
    expect(checkStepDate("2026-11-19", now)).toBeNull();
    expect(checkStepDate("2026-11-01", now)).toBeNull();
    // 10:00 UTC on the 19th is already the 20th in Auckland.
    expect(latestToday(now)).toBe("2026-11-20");
    expect(checkStepDate("2026-11-20", now)).toBeNull();
  });

  it("refuses a future date in plain words", () => {
    expect(checkStepDate("2026-11-21", now)).toBe("Pick today or an earlier date.");
    expect(checkStepDate("2027-01-01", now)).toBe(LEDGER_COPY.futureDate);
  });

  it.each(["", "19/11/2026", "2026-13-01", "2026-02-30", "1999-12-31", "2026-11-19T10:00:00Z", null, undefined, 20261119, "yesterday"])("refuses %s as not a real date", (value) => {
    expect(checkStepDate(value, now)).toBe(LEDGER_COPY.badDate);
  });

  it("stores a date at noon UTC so it reads as the same day everywhere", () => {
    expect(stepInstant("2026-11-19")).toBe("2026-11-19T12:00:00.000Z");
  });

  it("knows which steps a person may record", () => {
    expect([...HUMAN_KINDS]).toEqual(["brief_received", "questions_sent", "answers_received", "sent_to_client", "won", "lost"]);
    for (const kind of ["draft_completed", "red_pen_run", "", "WON", null, 3]) expect(isHumanKind(kind)).toBe(false);
    expect(LEDGER_KINDS).toHaveLength(8);
  });
});

describe("the value is parsed by code, with the parser fee terms use", () => {
  it.each([
    ["380k", "USD", 380_000],
    ["$380k", "USD", 380_000],
    ["$1.2m", "USD", 1_200_000],
    ["1.2 million", "GBP", 1_200_000],
    ["£45,000", "GBP", 45_000],
    ["45,000", "EUR", 45_000],
    ["€1,250,000", "EUR", 1_250_000],
    ["USD 90,000", "USD", 90_000],
    ["380k GBP", "GBP", 380_000],
    ["$90k", "AUD", 90_000],
    ["CHF 120,000", "CHF", 120_000],
    ["  250 thousand ", "SGD", 250_000],
    ["fixed fee of $95,000", "CAD", 95_000],
    ["120000.40", "NZD", 120_000],
  ])("%s in %s is %d", (text, currency, amount) => {
    expect(parseLedgerAmount(text, currency)).toEqual({ ok: true, amount, currency });
  });

  it.each([
    ["", "USD", LEDGER_COPY.needAmount],
    ["   ", "USD", LEDGER_COPY.needAmount],
    ["-5000", "USD", LEDGER_COPY.badAmount],
    ["$-5k", "USD", LEDGER_COPY.badAmount],
    ["0", "USD", LEDGER_COPY.badAmount],
    ["$300k to $350k", "USD", LEDGER_COPY.badAmount],
    ["about 380k", "USD", LEDGER_COPY.badAmount],
    ["38O,OOO", "USD", LEDGER_COPY.badAmount],
    ["1e9", "USD", LEDGER_COPY.badAmount],
    ["380k plus expenses", "USD", LEDGER_COPY.badAmount],
    ["<script>alert(1)</script>", "USD", LEDGER_COPY.badAmount],
    ["9".repeat(41), "USD", LEDGER_COPY.badAmount],
    ["$45k per month", "USD", LEDGER_COPY.monthlyAmount],
    ["£45,000 a month", "GBP", LEDGER_COPY.monthlyAmount],
    ["999,999,999,999,999", "USD", LEDGER_COPY.tooLarge],
    ["500000m", "USD", LEDGER_COPY.tooLarge],
  ])("refuses %s in %s", (text, currency, problem) => {
    expect(parseLedgerAmount(text, currency)).toEqual({ ok: false, problem });
  });

  it("refuses a currency outside the list, whatever the amount", () => {
    for (const currency of ["JPY", "usd", "US$", "", "BTC", null, undefined, 3]) expect(parseLedgerAmount("380k", currency)).toEqual({ ok: false, problem: LEDGER_COPY.badCurrency });
  });

  it("refuses an amount whose written currency disagrees with the one picked", () => {
    expect(parseLedgerAmount("£45,000", "USD")).toEqual({ ok: false, problem: "The amount says pounds but the currency is USD. Make them match." });
    expect(parseLedgerAmount("$45,000", "GBP")).toMatchObject({ ok: false });
    expect(parseLedgerAmount("EUR 45,000", "CHF")).toMatchObject({ ok: false });
  });

  it("lists exactly the currency codes the fee parser reads", () => {
    for (const code of LEDGER_CURRENCIES) expect(parseFee(`${code} 1,000`).fee_amount, code).toBe(1_000);
    expect(parseFee("JPY 1,000").fee_amount).toBeNull();
  });

  it("shows an amount with its code, never a symbol", () => {
    expect(formatLedgerAmount(380_000, "USD")).toBe("USD 380,000");
    expect(formatLedgerAmount(1_250_000.4, "EUR")).toBe("EUR 1,250,000");
  });
});

describe("who sees what, mirroring the database", () => {
  const board = { shared: true, archived: false };

  it("shows dates and counts to the owner, and to admins and leads while the board is shared", () => {
    expect(ledgerAccess({ role: "em", isOwner: true, shared: false, archived: false })).toBe("owner");
    expect(ledgerAccess({ role: "admin", isOwner: false, ...board })).toBe("partner");
    expect(ledgerAccess({ role: "lead", isOwner: false, ...board })).toBe("partner");
    expect(ledgerAccess({ role: "admin", isOwner: false, shared: false, archived: false })).toBe("none");
    expect(ledgerAccess({ role: "admin", isOwner: false, shared: true, archived: true })).toBe("none");
    expect(ledgerAccess({ role: "em", isOwner: false, ...board })).toBe("none");
    for (const role of ["coach", null, undefined, ""]) expect(ledgerAccess({ role, isOwner: true, ...board })).toBe("none");
  });

  it("lets an admin or lead who can edit an unshared board read its ledger, and nobody else", () => {
    const unshared = { isOwner: false, shared: false, archived: false };
    expect(ledgerAccess({ role: "admin", isEditor: true, ...unshared })).toBe("partner");
    expect(ledgerAccess({ role: "lead", isEditor: true, ...unshared })).toBe("partner");
    expect(ledgerAccess({ role: "lead", isEditor: true, isOwner: false, shared: true, archived: true })).toBe("partner");
    expect(ledgerAccess({ role: "admin", isEditor: false, ...unshared })).toBe("none");
    for (const role of ["em", "analyst", "coach", null]) expect(ledgerAccess({ role, isEditor: true, ...unshared })).toBe("none");
  });

  it("shows the value to admins and leads only: an em owner sees none", () => {
    expect(canSeeLedgerValue("em", "owner")).toBe(false);
    expect(canSeeLedgerValue("admin", "owner")).toBe(true);
    expect(canSeeLedgerValue("lead", "partner")).toBe(true);
    expect(canSeeLedgerValue("admin", "none")).toBe(false);
    expect(canSeeLedgerValue("coach", "owner")).toBe(false);
  });

  it("lets only admins and leads set the value, on a board they own, edit or see shared", () => {
    const off = { isOwner: false, isEditor: false, shared: false, archived: false };
    expect(canSetLedgerValue({ role: "admin", ...off, isEditor: true })).toBe(true);
    expect(canSetLedgerValue({ role: "lead", ...off, shared: true })).toBe(true);
    expect(canSetLedgerValue({ role: "admin", ...off, isOwner: true })).toBe(true);
    expect(canSetLedgerValue({ role: "admin", ...off })).toBe(false);
    expect(canSetLedgerValue({ role: "admin", ...off, shared: true, archived: true })).toBe(false);
    for (const role of ["em", "coach", null]) expect(canSetLedgerValue({ role, isOwner: true, isEditor: true, shared: true, archived: false })).toBe(false);
  });
});

describe("the read rule for editing admins and leads (20261119130000)", () => {
  const sql = readFileSync("supabase/migrations/20261119130000_s9_ledger_editor_read.sql", "utf8");

  it("only replaces the read rule: no table, column, policy or grant to members changes", () => {
    expect(sql).not.toMatch(/\b(create|alter|drop)\s+(table|policy|index|trigger)\b/i);
    expect(sql).not.toMatch(/\bgrant\b[^;]*\banon\b/i);
    expect(sql).toMatch(/revoke all on function public\.can_read_proposal_ledger\(uuid, uuid, boolean\) from anon/);
  });

  it("asks for an admin or lead, in this workspace, who is on the board and is not a coach or guest", () => {
    expect(sql).toMatch(/firm_role_in\(p_org\) in \('admin', 'lead'\)\s+and exists \(select 1 from engagement_members/);
    expect(sql).toContain("p.org_id = p_org");
    expect(sql).toContain("m.member_role <> 'coach'");
    expect(sql).toContain("not coalesce(p.is_guest, false)");
    // The fee gate is untouched: value still needs an admin or lead whatever else is true.
    expect(sql).toContain("(not p_fee or public.firm_role_in(p_org) in ('admin', 'lead'))");
  });
});
