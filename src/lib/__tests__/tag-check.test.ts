// 18 Nov: Firm Brain Build Spec, step 5. The check that needs a real model runs on the deployed site from the QA seed
// page. This pins what it checks (40 hand-labelled seed items, the seed's own labels) and how it scores a run.
import { describe, expect, it } from "vitest";

import { DEMO_BOARDS } from "@/lib/demo-firm";
import { DEMO_PEOPLE } from "@/lib/demo-firm/people";
import { itemTags } from "@/lib/demo-firm/plan";
import { METHODS, ROLES } from "@/lib/engagement-tags";
import {
  rawTags,
  scoreTagCheck,
  TAG_CHECK_CALLS,
  TAG_CHECK_ITEMS,
  TAG_CHECK_METHOD_BAR,
  TAG_CHECK_SITUATIONS,
  tagCheckCases,
  tagCheckLines,
  type TagCheckCase,
  type TagCheckResult,
} from "@/lib/tag-check-shared";

const NAMES = [...DEMO_PEOPLE.map((person) => person.name), ...DEMO_BOARDS.map((board) => board.client.name)];
const cases = tagCheckCases(DEMO_BOARDS);
const scored = cases.filter((entry) => entry.scored);

const usage = (tokensIn: number, tokensOut: number) => ({ tokensIn, tokensOut, costUsd: (tokensIn * 0.1 + tokensOut * 0.5) / 1_000_000 });

function result(entry: TagCheckCase, over: Partial<TagCheckResult> = {}): TagCheckResult {
  return {
    case: entry,
    ok: true,
    note: null,
    got: entry.expected,
    raw: { method: [...(entry.expected.method ?? [])], call_role: entry.expected.call_role ?? null, stage: entry.expected.stage ?? null, situation: entry.expected.situation ?? null },
    before: usage(500, 200),
    after: usage(600, 215),
    ...over,
  };
}

describe("the sample", () => {
  it("is 40 hand-labelled items, 12 of them calls with a role, plus 6 SOWs for the situation", () => {
    expect(scored).toHaveLength(TAG_CHECK_ITEMS);
    expect(scored.filter((entry) => entry.type === "call")).toHaveLength(TAG_CHECK_CALLS);
    expect(cases.filter((entry) => !entry.scored)).toHaveLength(TAG_CHECK_SITUATIONS);
    for (const entry of scored) {
      expect(entry.expected.method?.length, entry.title).toBeGreaterThan(0);
      for (const method of entry.expected.method ?? []) expect(METHODS).toContain(method);
      if (entry.type === "call") expect(ROLES).toContain(entry.expected.call_role);
    }
    for (const entry of cases.filter((candidate) => !candidate.scored)) expect(entry.expected.situation, entry.title).toBeTruthy();
  });

  it("uses the seed's own labels, never private or unplaced items, and is the same every run", () => {
    for (const entry of cases) {
      const board = DEMO_BOARDS.find((candidate) => candidate.key === entry.boardKey)!;
      const item = board.items.find((candidate) => candidate.key === entry.itemKey)!;
      expect(entry.expected).toEqual(itemTags(board, item));
      expect(item.visibility).not.toBe("private");
      expect(item.placed).not.toBe(false);
    }
    expect(tagCheckCases([...DEMO_BOARDS].reverse())).toEqual(cases);
    expect(new Set(cases.map((entry) => `${entry.boardKey}/${entry.itemKey}`)).size).toBe(cases.length);
    expect(new Set(scored.map((entry) => entry.boardKey)).size).toBeGreaterThanOrEqual(20);
  });

  it("can find each item again by board and title, the way the server looks it up", () => {
    for (const entry of cases) {
      const board = DEMO_BOARDS.find((candidate) => candidate.key === entry.boardKey)!;
      expect(board.items.filter((item) => item.title === entry.title), entry.title).toHaveLength(1);
    }
  });
});

describe("the score", () => {
  it("passes a run that matches every label", () => {
    const results = cases.map((entry) => result(entry));
    const report = scoreTagCheck(results, NAMES);
    expect(report).toMatchObject({ items: 40, failed: 0, methodExact: 40, methodOverlap: 40, methodPass: true, namesInStoredRoles: [], namesInRawRoles: [], outsideList: [] });
    expect(report.roles).toEqual({ matched: TAG_CHECK_CALLS, of: TAG_CHECK_CALLS });
    expect(report.situations).toEqual({ matched: TAG_CHECK_SITUATIONS, of: TAG_CHECK_SITUATIONS });
  });

  it("counts an exact method match only when the sets are the same, and fails below 34", () => {
    const wrong = (entry: TagCheckCase) => result(entry, { got: { ...entry.expected, method: [...(entry.expected.method ?? []), "other"] } });
    const at = (misses: number) => scoreTagCheck(scored.map((entry, index) => (index < misses ? wrong(entry) : result(entry))), NAMES);
    expect(at(TAG_CHECK_ITEMS - TAG_CHECK_METHOD_BAR)).toMatchObject({ methodExact: 34, methodOverlap: 40, methodPass: true });
    expect(at(TAG_CHECK_ITEMS - TAG_CHECK_METHOD_BAR + 1)).toMatchObject({ methodExact: 33, methodPass: false });
  });

  it("counts an item that could not be read as a miss, never as a match", () => {
    const results = scored.map((entry, index) => (index === 0 ? result(entry, { ok: false, note: "no readable text", got: {} }) : result(entry)));
    const report = scoreTagCheck(results, NAMES);
    expect(report).toMatchObject({ failed: 1, methodExact: 39 });
    expect(tagCheckLines(report, results).join("\n")).toContain("not read:");
  });

  it("reports a name the model wrote as a role, and fails only if one was stored", () => {
    const aCall = scored.find((entry) => entry.type === "call")!;
    const caught = scoreTagCheck([result(aCall, { got: { method: aCall.expected.method! }, raw: { ...rawTags(null), call_role: "Maren Hollis" } })], NAMES);
    expect(caught.namesInRawRoles).toEqual([aCall.title]);
    expect(caught.namesInStoredRoles).toEqual([]);
    const leaked = scoreTagCheck([result(aCall, { got: { call_role: "Maren Hollis" as never } })], NAMES);
    expect(leaked.namesInStoredRoles).toEqual([aCall.title]);
    expect(tagCheckLines(leaked, []).join("\n")).toMatch(/Names in stored roles: 1 \(must be 0\): FAIL/);
  });

  it("compares cost before and after, and holds it to twenty percent", () => {
    const within = scoreTagCheck(scored.map((entry) => result(entry, { before: usage(2000, 250), after: usage(2120, 264) })), NAMES);
    expect(within.cost.change).toBeGreaterThan(0);
    expect(within.cost.pass).toBe(true);
    const over = scoreTagCheck(scored.map((entry) => result(entry, { before: usage(300, 150), after: usage(600, 170) })), NAMES);
    expect(over.cost.pass).toBe(false);
    expect(tagCheckLines(over, scored.map((entry) => result(entry))).join("\n")).toMatch(/Change \+\d+\.\d% \(bar \+20\.0%\): FAIL/);
    // The figures from the live check (18 Nov 2026): 14.5% over passes at the accepted bar, 20.1% does not.
    expect(scoreTagCheck(scored.map((entry) => result(entry, { before: usage(817, 566), after: usage(1050, 624) })), NAMES).cost.pass).toBe(true);
    expect(scoreTagCheck(scored.map((entry) => result(entry, { before: usage(1000, 200), after: usage(1201, 240) })), NAMES).cost.pass).toBe(false);
    expect(scoreTagCheck([], NAMES).cost).toMatchObject({ change: null, pass: null });
  });

  it("shows what the model wrote that was not a list id", () => {
    const entry = scored[0]!;
    const report = scoreTagCheck([result(entry, { raw: { ...rawTags({ method: ["tea leaves", 7, { a: 1 }] }), call_role: null } })], NAMES);
    expect(report.outsideList.join("\n")).toContain('method "tea leaves"');
    expect(rawTags({ method: "survey", call_role: 12, stage: null })).toEqual({ method: ["survey"], call_role: "12", stage: null, situation: null });
  });

  it("writes its report without em dashes", () => {
    const results = cases.map((entry) => result(entry));
    expect(tagCheckLines(scoreTagCheck(results, NAMES), results).join("\n")).not.toMatch(new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`));
  });
});
