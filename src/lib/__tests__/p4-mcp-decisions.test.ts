import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { EVENT_DIM_KEYS } from "../event-dim-allowlist";
import {
  decisionsLine,
  decisionsWritable,
  isDuplicateDecision,
  parsePushDecisions,
  resolveCitedTurns,
} from "../mcp-decisions";

const good = { situation: "Which market first", call_text: "Start with Germany", cites: [3] };

describe("P4 decision validation", () => {
  it("accepts a valid list and absent decisions", () => {
    expect(parsePushDecisions(undefined)).toEqual({ ok: true, decisions: [] });
    const r = parsePushDecisions([good]);
    expect(r.ok && r.decisions[0]).toEqual({ ...good, why: null });
  });
  it("rejects missing or empty cites", () => {
    expect(parsePushDecisions([{ ...good, cites: undefined }]).ok).toBe(false);
    expect(parsePushDecisions([{ ...good, cites: [] }]).ok).toBe(false);
  });
  it("rejects non-positive or non-integer cites", () => {
    expect(parsePushDecisions([{ ...good, cites: [0] }]).ok).toBe(false);
    expect(parsePushDecisions([{ ...good, cites: [1.5] }]).ok).toBe(false);
    expect(parsePushDecisions([{ ...good, cites: ["2"] }]).ok).toBe(false);
  });
  it("rejects blank situation or call_text", () => {
    expect(parsePushDecisions([{ ...good, situation: "  " }]).ok).toBe(false);
    expect(parsePushDecisions([{ ...good, call_text: "" }]).ok).toBe(false);
  });
  it("rejects more than 20", () => {
    expect(parsePushDecisions(Array(21).fill(good)).ok).toBe(false);
  });
});

describe("position to turn resolution", () => {
  const map = new Map([
    [1, "t1"],
    [2, "t2"],
  ]);
  it("maps stored positions", () => expect(resolveCitedTurns([2, 1], map)).toEqual(["t2", "t1"]));
  it("returns null past what is stored", () => expect(resolveCitedTurns([1, 3], map)).toBeNull());
});

describe("dedupe", () => {
  const srcs = [{ work_item_id: "w", turn_id: "t1" }];
  it("matches same call_text and srcs on draft or confirmed", () => {
    expect(isDuplicateDecision({ call_text: "A", srcs }, [{ call_text: "A", srcs, status: "confirmed" }])).toBe(true);
  });
  it("ignores dismissed rows and different sources", () => {
    expect(isDuplicateDecision({ call_text: "A", srcs }, [{ call_text: "A", srcs, status: "dismissed" }])).toBe(false);
    expect(
      isDuplicateDecision({ call_text: "A", srcs }, [
        { call_text: "A", srcs: [{ work_item_id: "w", turn_id: "t2" }], status: "draft" },
      ]),
    ).toBe(false);
  });
});

describe("held when inbox", () => {
  it("writes only on a resolved board", () => {
    expect(decisionsWritable("workboard", true)).toBe(true);
    expect(decisionsWritable("workboard", false)).toBe(false);
    expect(decisionsWritable("inbox", true)).toBe(false);
  });
  it("summarises outcomes", () => {
    expect(
      decisionsLine([
        { situation: "", call_text: "", outcome: "drafted", cites: [1] },
        { situation: "", call_text: "", outcome: "drafted", cites: [1] },
        { situation: "", call_text: "", outcome: "held", cites: [1] },
      ]),
    ).toBe("Decisions: 2 drafted, 1 held.");
  });
});

describe("handler source", () => {
  const src = readFileSync("src/lib/mcp-handler.server.ts", "utf8");
  it("inserts drafts authored by ai_draft, never confirmed", () => {
    expect(src).toContain('status: "draft" as const,\n          author: "ai_draft" as const,');
    const block = src.slice(src.indexOf("P4 item 3"), src.indexOf("const decisionsDrafted"));
    expect(block).not.toContain('"confirmed" as const');
  });
  it("emits the decisions dim and allow-lists it", () => {
    expect(src).toContain("decisions: versionRowsBucket(decisionsDrafted)");
    expect(EVENT_DIM_KEYS["mcp.push"]).toContain("decisions");
  });
});
