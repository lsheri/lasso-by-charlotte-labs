import { describe, expect, it } from "vitest";

import { aiUsageRow, type ChatResult, type AiMeta } from "./ai.server";

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
