import { beforeEach, describe, expect, it, vi } from "vitest";

const health = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>> }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({ insert: async () => ({ error: null }), select: () => ({ eq: async () => ({ data: [] }) }) }),
    auth: { admin: { getUserById: async () => ({ data: { user: null }, error: null }) } },
  },
}));
vi.mock("../org-type.server", () => ({
  orgTypeOf: async () => "company",
  workspaceStamp: async () => ({ workspace_type: "company", affiliated: false }),
  accountStageOf: async () => null,
}));
vi.mock("../ai-key", () => ({
  openAiKeyFor: () => ({ key: "openai-test-only", source: "default" }),
  anthropicKeyFor: () => ({ key: "anthropic-test-only", source: "default" }),
}));
vi.mock("../health.server", () => ({
  logHealth: vi.fn(async (input: Record<string, unknown>) => {
    health.calls.push(input);
  }),
}));
vi.mock("../egress.server", () => ({ scheduleEgress: () => {} }));
vi.mock("../telemetry.server", () => ({ recordEvent: vi.fn(async () => undefined), computeActorHash: async () => null }));

import { chatComplete } from "../ai.server";

const oneToken = () =>
  Response.json({
    model: "claude-sonnet-5-5",
    stop_reason: "max_tokens",
    content: [{ type: "text", text: "R" }],
    usage: { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 385057, output_tokens: 1 },
  });

/**
 * AUDIT-1 (7 Nov 2026), A3 F16: a prime asks for one output token by design,
 * so finish_reason is "length" on every prime, and the health table and the
 * #ai-health channel reported a truncation on every one. The check now skips
 * the prime surface and nothing else.
 */
describe("AUDIT-1: a cache prime is never reported as truncated", () => {
  beforeEach(() => {
    process.env["ANTHROPIC_API_KEY"] = "anthropic-test-only";
    delete process.env["AI_PROVIDER"];
    health.calls = [];
    vi.stubGlobal("fetch", vi.fn(async () => oneToken()));
  });

  it("ask_prime with finish_reason length writes no truncated row", async () => {
    await chatComplete([{ role: "user", content: "x" }], { tier: "smart", maxTokens: 1, meta: { surface: "ask_prime", orgId: "o" }, awaitAccounting: true });
    expect(health.calls.filter((c) => c["kind"] === "truncated")).toHaveLength(0);
  });

  it("any other surface with finish_reason length still does", async () => {
    await chatComplete([{ role: "user", content: "x" }], { tier: "smart", maxTokens: 1, meta: { surface: "ask_lasso", orgId: "o" }, awaitAccounting: true });
    const truncated = health.calls.filter((c) => c["kind"] === "truncated");
    expect(truncated).toHaveLength(1);
    expect(truncated[0]).toMatchObject({ surface: "ask_lasso" });
  });
});
