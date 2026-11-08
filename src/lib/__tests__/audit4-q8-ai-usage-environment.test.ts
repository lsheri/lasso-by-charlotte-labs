import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  host: undefined as string | undefined,
  inserts: [] as Array<Record<string, unknown>>,
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => mocks.host }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        mocks.inserts.push(row);
        return { error: null };
      },
    }),
  },
}));

import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
import { aiUsageRow, recordUsage, type AiMeta, type ChatResult } from "@/lib/ai.server";

function aResult(): ChatResult {
  return {
    text: "an answer",
    toolArgs: null,
    toolCalls: [],
    finishReason: "stop",
    model: "claude-sonnet-5-5",
    tokensIn: 1200,
    tokensOut: 340,
    cachedIn: 200,
    costUsd: 0.00235,
    durationMs: 4211,
  };
}

/**
 * AUDIT-4 Q8 (8 Nov 2026), A3 F13: the usage ledger had no environment and
 * no record of the context mode, so cost per question could not be split by
 * world or by how the answer was assembled.
 */
describe("AUDIT-4 Q8: ai_usage carries environment and context mode", () => {
  it("stamps the environment from the request host when a row is written", async () => {
    mocks.inserts.length = 0;
    mocks.host = "id-preview--x.lovable.app";
    await recordUsage(aResult(), { surface: "ask_lasso", contextMode: "inline" });
    mocks.host = "lasso.charlotte-labs.com";
    await recordUsage(aResult(), { surface: "ask_lasso", contextMode: "inline" });
    expect(mocks.inserts.map((r) => r["environment"])).toEqual(["preview", "production"]);
    expect(mocks.inserts[0]!["context_mode"]).toBe("inline");
  });

  it("is unknown outside a request, never a guess", async () => {
    mocks.inserts.length = 0;
    mocks.host = undefined;
    await recordUsage(aResult(), { surface: "extract" });
    expect(mocks.inserts[0]!["environment"]).toBe("unknown");
    expect(aiUsageRow(aResult(), { surface: "extract" }).environment).toBe("unknown");
  });

  it("records the context mode an Ask answer used, and null elsewhere", () => {
    const ask: AiMeta = { surface: "ask_lasso", contextMode: "catalogue" };
    expect(aiUsageRow(aResult(), ask).context_mode).toBe("catalogue");
    expect(aiUsageRow(aResult(), { surface: "ask_lasso", contextMode: "inline" }).context_mode).toBe("inline");
    expect(aiUsageRow(aResult(), { surface: "ask_prime" }).context_mode).toBeNull();
    expect(aiUsageRow(aResult(), undefined).context_mode).toBeNull();
  });

  it("still carries no person-identifying key", () => {
    const keys = Object.keys(aiUsageRow(aResult(), { surface: "ask_lasso", contextMode: "inline" }));
    for (const banned of ["actor_hash", "user_id", "org_name", "text", "content", "prompt", "golden"]) {
      expect(keys).not.toContain(banned);
    }
  });

  it("declares context_mode on the ai.usage mirror so the server guard keeps it", () => {
    expect(EVENT_DIM_KEYS["ai.usage"]).toContain("context_mode");
  });
});
