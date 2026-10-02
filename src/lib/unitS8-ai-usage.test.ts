import { describe, expect, it, vi } from "vitest";

import { aiUsageRow, computeCostUsd, priceKeyFor, type ChatResult, type AiMeta } from "./ai.server";

function aResult(): ChatResult {
  return {
    text: "an answer",
    toolArgs: null,
    toolCalls: [],
    finishReason: "stop",
    model: "gpt-5",
    tokensIn: 1200,
    tokensOut: 340,
    cachedIn: 200,
    costUsd: 0.00235,
    durationMs: 4211,
  };
}

describe("unit S8 ai usage rows", () => {
  it("maps a ChatResult and an AiMeta onto the ai_usage columns", () => {
    const meta: AiMeta = { surface: "ask_dock", orgId: "1f0e6d0e-0000-4000-8000-000000000001" };
    expect(aiUsageRow(aResult(), meta)).toEqual({
      org_id: "1f0e6d0e-0000-4000-8000-000000000001",
      surface: "ask_dock",
      model: "gpt-5",
      tokens_in: 1200,
      cached_in: 200,
      tokens_out: 340,
      cost_usd: 0.00235,
      duration_ms: 4211,
      finish_reason: "stop",
    });
  });

  it("writes a null workspace and an unknown surface when there is no meta", () => {
    const row = aiUsageRow(aResult(), undefined);
    expect(row.org_id).toBeNull();
    expect(row.surface).toBe("unknown");
  });

  it("never carries a person field or any content", () => {
    const keys = Object.keys(aiUsageRow(aResult(), undefined));
    const banned = [
      "actor_hash",
      "actorHash",
      "profile_id",
      "profileId",
      "user_id",
      "userId",
      "org_name",
      "orgName",
      "text",
      "content",
      "prompt",
      "messages",
    ];
    for (const key of keys) expect(banned).not.toContain(key);
  });
});

describe("unit AU1 served model and pricing", () => {
  it("normalises a model id to its price key", () => {
    expect(priceKeyFor("gpt-5-2025-08-07")).toBe("gpt-5");
    expect(priceKeyFor("gpt-4.1-mini")).toBe("gpt-4.1-mini");
    expect(priceKeyFor("claude-3")).toBeNull();
  });

  it("prices a dated snapshot as its alias", () => {
    const snap = computeCostUsd("gpt-5-2025-08-07", 1_000_000, 0, 0);
    expect(snap).toBe(computeCostUsd("gpt-5", 1_000_000, 0, 0));
    expect(snap).not.toBe(computeCostUsd("gpt-4.1-mini", 1_000_000, 0, 0));
  });

  it("writes the served snapshot onto the row", () => {
    const row = aiUsageRow({ ...aResult(), model: "gpt-5-2025-08-07" }, { surface: "ask_dock" });
    expect(row.model).toBe("gpt-5-2025-08-07");
  });

  it("bills question_intent to the org id the caller supplies", async () => {
    vi.resetModules();
    const seen: AiMeta[] = [];
    vi.doMock("./ai.server", async (importOriginal) => ({
      ...(await importOriginal<typeof import("./ai.server")>()),
      chatComplete: vi.fn(async (_m: unknown, opts: { meta: AiMeta }) => {
        seen.push(opts.meta);
        return { ...aResult(), text: "" };
      }),
    }));
    const { classifyQuestionIntent } = await import("./question-intent.server");
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: null }) };
    const supabase = { from: () => chain } as never;
    const ORG = "7a1b2c3d-0000-4000-8000-0000000000aa";
    await classifyQuestionIntent(supabase, {
      userId: "u", profileId: "p", orgId: ORG, question: "q", scopeMode: "whole",
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.surface).toBe("question_intent");
    expect(aiUsageRow(aResult(), seen[0]).org_id).toBe(ORG);
    vi.doUnmock("./ai.server");
  });
});
