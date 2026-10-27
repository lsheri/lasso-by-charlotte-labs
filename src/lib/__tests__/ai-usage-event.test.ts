import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => table === "data_consent_state"
      ? { select: () => ({ eq: async () => ({ data: [{ scope: "org", tier: "c", ledger_version: 1 }] }) }) }
      : { insert: (row: unknown) => mocks.insert(table, row) },
    auth: { admin: { getUserById: async () => ({ data: { user: null }, error: null }) } },
  },
}));
vi.mock("../org-type.server", () => ({
  orgTypeOf: async () => "company",
  workspaceStamp: async () => ({ workspace_type: "company", affiliated: false }),
  accountStageOf: async () => null,
}));
vi.mock("../ai-key", () => ({ openAiKeyFor: () => ({ key: "test-only" }) }));
vi.mock("../health.server", () => ({ logHealth: async () => {} }));
vi.mock("../egress.server", () => ({ scheduleEgress: () => {} }));

import { chatComplete, recordUsage, type ChatResult } from "../ai.server";
import * as telemetry from "../telemetry.server";
import { guardEventDims } from "../event-dim-allowlist";

const result: ChatResult = {
  text: "Private answer", toolArgs: null, toolCalls: [], finishReason: "stop",
  model: "gpt-5", tokensIn: 1200, tokensOut: 340, cachedIn: 200,
  costUsd: 0.00235, durationMs: 4211,
};
const meta = { surface: "ask_dock", orgId: "usage-org", userId: "usage-user", profileId: "usage-profile" };
const dims = { surface: "ask_dock", model: "gpt-5", cost_usd: 0.00235,
  tokens_in: 1200, tokens_out: 340, cached_in: 200, duration_ms: 4211, finish_reason: "stop" };
let fetchMock: ReturnType<typeof vi.fn>;
function mirrors() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes("posthog"))
    .map(([, options]) => JSON.parse(options.body));
}
beforeEach(() => {
  vi.restoreAllMocks();
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  telemetry.resetConsentCache();
  process.env["TELEMETRY_SALT"] = "test-salt";
  fetchMock = vi.fn(async () => new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("AI usage accounting mirror", () => {
  it("an AI call emits once with all eight exact dimensions and caller identity", async () => {
    fetchMock.mockImplementation(async (url) => String(url).includes("openai.com")
      ? Response.json({ model: "gpt-5", choices: [{ message: { content: "Private answer" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1200, completion_tokens: 340, prompt_tokens_details: { cached_tokens: 200 } } })
      : new Response("ok"));
    const emit = vi.spyOn(telemetry, "recordEvent");
    const answer = await chatComplete([{ role: "user", content: "Private prompt" }], { meta });
    await vi.waitFor(() => expect(mirrors()).toHaveLength(1));
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]?.[1]).toEqual({ eventType: "ai.usage", orgId: meta.orgId,
      userId: meta.userId, profileId: meta.profileId, dims: { ...dims, cost_usd: answer.costUsd, duration_ms: answer.durationMs } });
    expect(mirrors()[0].event).toBe("ai.usage");
    for (const [key, value] of Object.entries({ ...dims, cost_usd: answer.costUsd, duration_ms: answer.durationMs })) {
      expect(mirrors()[0].properties[key]).toBe(value);
    }
    expect(mirrors()[0].distinct_id).toBe(meta.userId);
    expect(mirrors()[0].properties.$groups).toEqual({ org: await telemetry.sha256Hex(meta.orgId) });
  });
  it("outbound cost and tokens are exact, not bucketed", async () => {
    await recordUsage(result, meta);
    await vi.waitFor(() => expect(mirrors()).toHaveLength(1));
    expect(mirrors()[0].properties).toMatchObject(dims);
    expect(mirrors()[0].properties.cost_usd).toBe(0.00235);
    expect(guardEventDims("ai.usage", dims).dims).toEqual(dims);
  });
  it("no workspace emits nothing but still writes the usage row", async () => {
    const emit = vi.spyOn(telemetry, "recordEvent");
    await recordUsage(result, { surface: "extract" });
    expect(mocks.insert).toHaveBeenCalledExactlyOnceWith("ai_usage", expect.objectContaining({ org_id: null, cost_usd: 0.00235 }));
    expect(emit).not.toHaveBeenCalled();
    expect(mirrors()).toHaveLength(0);
  });
  it("a thrown emit error never propagates out of recordUsage", async () => {
    const emit = vi.spyOn(telemetry, "recordEvent").mockImplementation(() => { throw new Error("emit failed"); });
    await expect(recordUsage(result, meta)).resolves.toBeUndefined();
    await vi.waitFor(() => expect(emit).toHaveBeenCalledTimes(1));
    expect(mocks.insert).toHaveBeenCalledWith("ai_usage", expect.objectContaining({ cost_usd: 0.00235 }));
  });
  it("recordUsage resolves while the event emit is still pending", async () => {
    let finish: (() => void) | undefined;
    let completed = false;
    const pending = new Promise<void>((resolve) => { finish = () => { completed = true; resolve(); }; });
    const emit = vi.spyOn(telemetry, "recordEvent").mockReturnValue(pending);
    try {
      await expect(recordUsage(result, meta)).resolves.toBeUndefined();
      await vi.waitFor(() => expect(emit).toHaveBeenCalledTimes(1));
      expect(completed).toBe(false);
    } finally { finish?.(); }
  });
  it("sends only the eight permitted dimensions and never content", async () => {
    const emit = vi.spyOn(telemetry, "recordEvent");
    await recordUsage(result, meta);
    await vi.waitFor(() => expect(mirrors()).toHaveLength(1));
    expect(Object.keys(emit.mock.calls[0]?.[1].dims ?? {}).sort()).toEqual(Object.keys(dims).sort());
    for (const key of ["text", "prompt", "answer", "title", "content", "board_name", "client_name", "workstream_name"]) {
      expect(mirrors()[0].properties).not.toHaveProperty(key);
    }
    expect(JSON.stringify(mirrors()[0])).not.toContain(result.text);
  });
  it("registers ai.usage without a direct PostHog path in AI accounting", () => {
    expect(readFileSync("src/lib/telemetry-shared.ts", "utf8")).toContain('| "ai.usage"');
    const source = readFileSync("src/lib/ai.server.ts", "utf8");
    expect(source).not.toMatch(/from\s+["'][^"']*posthog|import\(["'][^"']*posthog|fetch\([^\n]*posthog/i);
  });
});