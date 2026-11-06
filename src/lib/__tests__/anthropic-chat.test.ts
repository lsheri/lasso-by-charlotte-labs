import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => table === "data_consent_state"
      ? { select: () => ({ eq: async () => ({ data: [{ scope: "org", tier: "c", ledger_version: 1 }] }) }) }
      : { insert: async () => ({ error: null }) },
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
const health = vi.hoisted(() => ({ logHealth: vi.fn(async () => undefined) }));
vi.mock("../health.server", () => ({ logHealth: health.logHealth }));
vi.mock("../egress.server", () => ({ scheduleEgress: () => {} }));

import { MODELS, chatComplete, streamChat } from "../ai.server";

const meta = { surface: "ask_dock", orgId: "org-1" };
let fetchMock: ReturnType<typeof vi.fn>;

function anthropicOk(text = "From Claude.") {
  return Response.json({
    model: "claude-sonnet-5-5",
    stop_reason: "end_turn",
    content: [{ type: "text", text }],
    usage: { input_tokens: 100, cache_read_input_tokens: 900, output_tokens: 25 },
  });
}

beforeEach(() => {
  process.env["ANTHROPIC_API_KEY"] = "anthropic-test-only";
  delete process.env["AI_PROVIDER"];
  process.env["TELEMETRY_SALT"] = "test-salt";
  health.logHealth.mockClear();
  fetchMock = vi.fn(async () => new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["ANTHROPIC_API_KEY"];
});

const calls = (host: string) => fetchMock.mock.calls.filter(([url]) => String(url).includes(host));

describe("KEY-1 chatComplete on Anthropic", () => {
  it("sends to api.anthropic.com with the key header and prices the Claude usage", async () => {
    fetchMock.mockImplementation(async (url) => (String(url).includes("api.anthropic.com") ? anthropicOk() : new Response("ok")));
    expect(MODELS.smart).toBe("claude-sonnet-5-5");
    const answer = await chatComplete([{ role: "system", content: "Be brief." }, { role: "user", content: "hi" }], { meta });
    const [, init] = calls("api.anthropic.com")[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("anthropic-test-only");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("claude-sonnet-5-5");
    expect(body.system).toBe("Be brief.");
    expect(answer.text).toBe("From Claude.");
    expect(answer.model).toBe("claude-sonnet-5-5");
    expect(answer.tokensIn).toBe(1000);
    expect(answer.cachedIn).toBe(900);
    expect(answer.tokensOut).toBe(25);
    // 100 fresh at $2/M + 900 cached at $0.10/M + 25 out at $10/M
    expect(answer.costUsd).toBeCloseTo(0.0002 + 0.00009 + 0.00025, 8);
    expect(calls("openai.com")).toHaveLength(0);
  });

  it("falls back to OpenAI once when Anthropic answers 529, and logs the hop", async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes("api.anthropic.com")) return new Response(JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }), { status: 529 });
      if (String(url).includes("openai.com")) return Response.json({ model: "gpt-5", choices: [{ message: { content: "From OpenAI." }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
      return new Response("ok");
    });
    const answer = await chatComplete([{ role: "user", content: "hi" }], { meta });
    expect(answer.text).toBe("From OpenAI.");
    expect(answer.model).toBe("gpt-5");
    expect(calls("api.anthropic.com")).toHaveLength(1);
    expect(calls("openai.com")).toHaveLength(1);
    const hop = (health.logHealth.mock.calls as unknown as [{ surface?: string; meta?: Record<string, unknown> }][])
      .map(([input]) => input)
      .find((input) => input.surface === "model_fallback");
    expect(hop?.meta?.["provider_fallback"]).toBe("openai");
    expect(hop?.meta?.["http_status"]).toBe(529);
  });

  it("never falls back on a 4xx", async () => {
    fetchMock.mockImplementation(async (url) => String(url).includes("api.anthropic.com")
      ? new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), { status: 401 })
      : new Response("ok"));
    await expect(chatComplete([{ role: "user", content: "hi" }], { meta })).rejects.toThrow();
    expect(calls("openai.com")).toHaveLength(0);
  });

  it("honours AI_PROVIDER=openai even with the Anthropic key present", async () => {
    process.env["AI_PROVIDER"] = "openai";
    fetchMock.mockImplementation(async (url) => String(url).includes("openai.com")
      ? Response.json({ model: "gpt-5", choices: [{ message: { content: "From OpenAI." }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } })
      : new Response("ok"));
    expect(MODELS.smart).toBe("gpt-5");
    const answer = await chatComplete([{ role: "user", content: "hi" }], { meta });
    expect(answer.text).toBe("From OpenAI.");
    expect(calls("api.anthropic.com")).toHaveLength(0);
    delete process.env["AI_PROVIDER"];
  });

  it("streams deltas from the Anthropic event stream", async () => {
    const encoder = new TextEncoder();
    const events = [
      { type: "message_start", message: { model: "claude-haiku-5-5", usage: { input_tokens: 8 } } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hi " } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "there" } },
      { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } },
      { type: "message_stop" },
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        controller.close();
      },
    });
    fetchMock.mockImplementation(async (url) => (String(url).includes("api.anthropic.com") ? new Response(stream, { status: 200 }) : new Response("ok")));
    const seen: string[] = [];
    const answer = await streamChat([{ role: "user", content: "hi" }], (delta) => { seen.push(delta); }, { tier: "fast", meta });
    expect(seen).toEqual(["Hi ", "there"]);
    expect(answer.text).toBe("Hi there");
    expect(answer.model).toBe("claude-haiku-5-5");
    expect(answer.tokensIn).toBe(8);
    expect(answer.tokensOut).toBe(2);
    expect(answer.interrupted).toBe(false);
    const body = JSON.parse(String((calls("api.anthropic.com")[0] as [string, RequestInit])[1].body));
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.stream).toBe(true);
  });
});
