import { describe, expect, it } from "vitest";

import { DAILY_ANALYSIS_CAP, assertUnderDailyCap } from "@/lib/analysis-cap.server";
import { accountTextResults } from "@/lib/reflect-context.server";
import { buildAnalysisConversation, buildReflectConversation } from "@/lib/prompt-assembly";

function fakeSupabase(count: number) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => Promise.resolve({ count, error: null }),
  };
  return { from: () => chain } as never;
}

describe("daily analysis cap", () => {
  it("lets a run through below the cap", async () => {
    await expect(
      assertUnderDailyCap(fakeSupabase(DAILY_ANALYSIS_CAP - 1), "p1"),
    ).resolves.toBeUndefined();
  });

  it("refuses once the cap is reached", async () => {
    await expect(assertUnderDailyCap(fakeSupabase(DAILY_ANALYSIS_CAP), "p1")).rejects.toThrow(
      /daily limit/,
    );
  });
});

type Fetched = Parameters<typeof accountTextResults>[0];

function fetched(entries: Array<[string, string]>): Fetched {
  return entries.map(([id, text]) => ({
    item: { id, content_ref: null },
    result: { status: "ok" as const, text },
  }));
}

describe("text budget accounting", () => {
  it("matches a serial pass: same inclusions, same order, same stop point", () => {
    const budget = 20;
    const batch = fetched([
      ["a", "x".repeat(8)],
      ["b", "y".repeat(8)],
      ["c", "z".repeat(8)],
      ["d", "w".repeat(8)],
    ]);
    const state = { fullText: new Map<string, string>(), unreadable: new Map(), rawUsed: 0 };
    const out = accountTextResults(batch, budget, state);
    expect([...state.fullText.keys()]).toEqual(["a", "b", "c"]);
    expect(state.fullText.get("c")).toContain("z");
    expect(out.stop).toBe(true);
    expect(out.rawUsed).toBe(budget);
  });

  it("records unreadable items without spending budget", () => {
    const state = { fullText: new Map<string, string>(), unreadable: new Map(), rawUsed: 0 };
    const out = accountTextResults(
      [
        { item: { id: "a", content_ref: "ref" }, result: { status: "failed", note: "boom" } },
        ...fetched([["b", "ok"]]),
      ],
      1000,
      state,
    );
    expect(state.unreadable.get("a")?.status).toBe("failed");
    expect([...state.fullText.keys()]).toEqual(["b"]);
    expect(out.rawUsed).toBe(2);
  });
});

describe("prompt prefix stability", () => {
  it("keeps system prompts and history ahead of the volatile record", () => {
    const prompts = [{ role: "system" as const, content: "SYS" }];
    const history = [{ role: "user" as const, content: "earlier" }];
    const one = buildReflectConversation({
      prompts,
      historyMessages: history,
      scopeMode: "whole",
      context: "CTX A",
      message: "q",
    });
    const two = buildReflectConversation({
      prompts,
      historyMessages: history,
      scopeMode: "whole",
      context: "CTX B",
      message: "q",
    });
    expect(one.slice(0, 2)).toEqual(two.slice(0, 2));
    expect(one[2]!.content).toContain("CTX A");
    expect(one.at(-1)).toEqual({ role: "user", content: "q" });
  });

  it("keeps the preset prompt byte identical whether or not firm checks exist", () => {
    const base = {
      systemPrompt: "SYS",
      presetPrompt: "PRESET",
      heading: "THE WORK UNDER ANALYSIS",
      context: "CTX",
      kindLine: "",
      tailInstruction: null,
      openingMessage: "go",
    };
    const without = buildAnalysisConversation({ ...base, checksBlock: null });
    const with_ = buildAnalysisConversation({ ...base, checksBlock: "CHECKS" });
    expect(without[1]).toEqual(with_[1]);
    expect(with_[2]).toEqual({ role: "system", content: "CHECKS" });
    expect(with_.at(-1)).toEqual({ role: "user", content: "go" });
  });

  it("places the handoff tail before the opening message", () => {
    const out = buildAnalysisConversation({
      systemPrompt: "SYS",
      presetPrompt: "PRESET",
      checksBlock: null,
      heading: "H",
      context: "CTX",
      kindLine: "",
      tailInstruction: "TAIL",
      openingMessage: "go",
    });
    expect(out.at(-2)).toEqual({ role: "system", content: "TAIL" });
  });
});
