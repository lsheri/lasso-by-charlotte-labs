import { beforeEach, describe, expect, it, vi } from "vitest";

const inserts = vi.hoisted(() => ({ rows: [] as unknown[], release: null as null | (() => void) }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) =>
      table === "ai_usage"
        ? {
            // The write is slow on purpose: only a caller that awaits it sees the row.
            insert: (row: unknown) =>
              new Promise((resolve) => {
                inserts.release = () => {
                  inserts.rows.push(row);
                  resolve({ error: null });
                };
                setTimeout(() => inserts.release?.(), 30);
              }),
          }
        : { insert: async () => ({ error: null }), select: () => ({ eq: async () => ({ data: [] }) }) },
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
vi.mock("../health.server", () => ({ logHealth: vi.fn(async () => undefined) }));
vi.mock("../egress.server", () => ({ scheduleEgress: () => {} }));
vi.mock("../telemetry.server", () => ({ recordEvent: vi.fn(async () => undefined), computeActorHash: async () => null }));

import { chatComplete } from "../ai.server";

const ok = () =>
  Response.json({
    model: "claude-sonnet-5-5",
    stop_reason: "max_tokens",
    content: [{ type: "text", text: "R" }],
    usage: { input_tokens: 10, cache_read_input_tokens: 385057, cache_creation_input_tokens: 0, output_tokens: 1 },
  });

describe("TOTAL-5b: a prime's cost is recorded before the route answers", () => {
  beforeEach(() => {
    process.env["ANTHROPIC_API_KEY"] = "anthropic-test-only";
    delete process.env["AI_PROVIDER"];
    inserts.rows = [];
    vi.stubGlobal("fetch", vi.fn(async () => ok()));
  });

  it("with awaitAccounting the usage row exists when chatComplete returns", async () => {
    await chatComplete([{ role: "user", content: "x" }], { tier: "smart", maxTokens: 1, meta: { surface: "ask_prime", orgId: "o" }, awaitAccounting: true });
    expect(inserts.rows).toHaveLength(1);
    expect(inserts.rows[0]).toMatchObject({ surface: "ask_prime", cached_in: 385057, tokens_out: 1 });
  });

  it("without it the write is still detached, as every other surface expects", async () => {
    await chatComplete([{ role: "user", content: "x" }], { tier: "smart", maxTokens: 1, meta: { surface: "ask_lasso", orgId: "o" } });
    expect(inserts.rows).toHaveLength(0);
  });
});
