import { describe, expect, it, vi } from "vitest";

import { providerFor } from "../ai.server";
import {
  RESPOND_TOOL,
  anthropicProviderCode,
  classifyAnthropic,
  fromAnthropicResponse,
  readAnthropicStream,
  toAnthropicBody,
  toAnthropicToolChoice,
  toAnthropicTools,
} from "../anthropic.server";

function sse(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`);
  // Split one event across two chunks to prove buffering.
  const joined = chunks.join("");
  const mid = Math.floor(joined.length / 2);
  const parts = [joined.slice(0, mid), joined.slice(mid)];
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

describe("KEY-1 provider switch", () => {
  it("AI_PROVIDER=openai wins, a key alone picks anthropic, nothing picks openai", () => {
    expect(providerFor({ AI_PROVIDER: "openai", ANTHROPIC_API_KEY: "x" })).toBe("openai");
    expect(providerFor({ ANTHROPIC_API_KEY: "x" })).toBe("anthropic");
    expect(providerFor({ ANTHROPIC_API_KEY: "  " })).toBe("openai");
    expect(providerFor({})).toBe("openai");
  });
});

describe("KEY-1 request body", () => {
  it("joins system messages into the top-level system and maps text turns", () => {
    const body = toAnthropicBody(
      [
        { role: "system", content: "You are Lasso." },
        { role: "system", content: "Describe work, never workers." },
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
      "claude-sonnet-5-5",
      {},
      false,
    );
    expect(body["system"]).toBe("You are Lasso.\n\nDescribe work, never workers.");
    expect(body["messages"]).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
    expect(body["max_tokens"]).toBe(8000);
    expect(body["stream"]).toBeUndefined();
    expect(body["output_config"]).toBeUndefined();
  });

  it("round-trips a tool call and merges consecutive tool results into one user turn", () => {
    const body = toAnthropicBody(
      [
        { role: "user", content: "link these" },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            { id: "toolu_1", type: "function", function: { name: "record_links", arguments: '{"a":1}' } },
            { id: "toolu_2", type: "function", function: { name: "record_links", arguments: '{"a":2}' } },
          ],
        },
        { role: "tool", content: "ok 1", tool_call_id: "toolu_1" },
        { role: "tool", content: "ok 2", tool_call_id: "toolu_2" },
      ],
      "claude-sonnet-5-5",
      { tools: [{ type: "function", function: { name: "record_links", description: "d", parameters: { type: "object" } } }], toolChoice: { type: "function", function: { name: "record_links" } } },
      false,
    );
    const messages = body["messages"] as { role: string; content: unknown }[];
    expect(messages).toHaveLength(3);
    expect(messages[1]).toEqual({
      role: "assistant",
      content: [
        { type: "tool_use", id: "toolu_1", name: "record_links", input: { a: 1 } },
        { type: "tool_use", id: "toolu_2", name: "record_links", input: { a: 2 } },
      ],
    });
    expect(messages[2]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "toolu_1", content: "ok 1" },
        { type: "tool_result", tool_use_id: "toolu_2", content: "ok 2" },
      ],
    });
    expect(body["tools"]).toEqual([{ name: "record_links", description: "d", input_schema: { type: "object" } }]);
    expect(body["tool_choice"]).toEqual({ type: "tool", name: "record_links" });
  });

  it("turns json_schema into a forced respond tool and json_object into a system line", () => {
    const schema = { type: "object", properties: { ok: { type: "boolean" } } };
    const strict = toAnthropicBody([{ role: "user", content: "x" }], "m", { responseFormat: { type: "json_schema", json_schema: { name: "shape", schema } } }, false);
    expect(strict["tools"]).toEqual([{ name: RESPOND_TOOL, description: "Return the answer in the required shape.", input_schema: schema }]);
    expect(strict["tool_choice"]).toEqual({ type: "tool", name: RESPOND_TOOL });
    const loose = toAnthropicBody([{ role: "system", content: "s" }, { role: "user", content: "x" }], "m", { responseFormat: { type: "json_object" } }, true);
    expect(loose["system"]).toBe("s\n\nReply with one JSON object and nothing else.");
    expect(loose["tools"]).toBeUndefined();
    expect(loose["stream"]).toBe(true);
  });

  it("passes effort through output_config and folds minimal into low", () => {
    expect(toAnthropicBody([{ role: "user", content: "x" }], "m", { reasoningEffort: "high" }, false)["output_config"]).toEqual({ effort: "high" });
    expect(toAnthropicBody([{ role: "user", content: "x" }], "m", { reasoningEffort: "minimal" }, false)["output_config"]).toEqual({ effort: "low" });
  });

  it("maps tool choice words", () => {
    expect(toAnthropicToolChoice("auto")).toEqual({ type: "auto" });
    expect(toAnthropicToolChoice("required")).toEqual({ type: "any" });
    expect(toAnthropicToolChoice(undefined)).toBeUndefined();
    expect(toAnthropicTools(undefined)).toBeUndefined();
  });
});

describe("KEY-1 response", () => {
  it("collapses text blocks, reports tool calls, maps usage with cache fields and stop reasons", () => {
    const parsed = fromAnthropicResponse(
      {
        model: "claude-sonnet-5-5",
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "Linking." },
          { type: "tool_use", id: "toolu_9", name: "record_links", input: { links: [] } },
        ],
        usage: { input_tokens: 100, cache_read_input_tokens: 400, cache_creation_input_tokens: 50, output_tokens: 20 },
      },
      "claude-sonnet-5-5",
      {},
    );
    expect(parsed.text).toBe("Linking.");
    expect(parsed.toolCalls).toEqual([{ id: "toolu_9", name: "record_links", arguments: '{"links":[]}' }]);
    expect(parsed.finishReason).toBe("tool_calls");
    expect(parsed.tokensIn).toBe(550);
    expect(parsed.cachedIn).toBe(400);
    expect(parsed.tokensOut).toBe(20);
    expect(fromAnthropicResponse({ stop_reason: "max_tokens", content: [] }, "m", {}).finishReason).toBe("length");
    expect(fromAnthropicResponse({ stop_reason: "end_turn", content: [] }, "m", {}).finishReason).toBe("stop");
  });

  it("returns the respond tool's input as text for json_schema and strips fences for json_object", () => {
    const strict = fromAnthropicResponse(
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t", name: RESPOND_TOOL, input: { ok: true } }] },
      "m",
      { responseFormat: { type: "json_schema", json_schema: { schema: {} } } },
    );
    expect(strict.text).toBe('{"ok":true}');
    expect(strict.toolCalls).toEqual([]);
    expect(strict.finishReason).toBe("stop");
    const loose = fromAnthropicResponse({ stop_reason: "end_turn", content: [{ type: "text", text: '```json\n{"ok":1}\n```' }] }, "m", { responseFormat: { type: "json_object" } });
    expect(loose.text).toBe('{"ok":1}');
  });

  it("reads a stream: deltas in order, tool input reassembled, usage at the end", async () => {
    const seen: string[] = [];
    const parsed = await readAnthropicStream(
      sse([
        { type: "message_start", message: { model: "claude-haiku-5-5", usage: { input_tokens: 10, cache_read_input_tokens: 5 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hel" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "lo" } },
        { type: "content_block_stop", index: 0 },
        { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_s", name: "record_links" } },
        { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"a"' } },
        { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: ":1}" } },
        { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 7 } },
        { type: "message_stop" },
      ]),
      (delta) => {
        seen.push(delta);
      },
      "claude-haiku-5-5",
      {},
    );
    expect(seen).toEqual(["Hel", "lo"]);
    expect(parsed.text).toBe("Hello");
    expect(parsed.toolCalls).toEqual([{ id: "toolu_s", name: "record_links", arguments: '{"a":1}' }]);
    expect(parsed.finishReason).toBe("tool_calls");
    expect(parsed.tokensIn).toBe(15);
    expect(parsed.cachedIn).toBe(5);
    expect(parsed.tokensOut).toBe(7);
    expect(parsed.interrupted).toBe(false);
  });

  it("keeps what arrived when the stream breaks", async () => {
    const encoder = new TextEncoder();
    let pulls = 0;
    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "part" } })}\n`));
        } else {
          controller.error(new Error("socket closed"));
        }
      },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const parsed = await readAnthropicStream(broken, () => undefined, "m", {});
    spy.mockRestore();
    expect(parsed.text).toBe("part");
    expect(parsed.interrupted).toBe(true);
  });
});

describe("KEY-1 errors", () => {
  const body = (type: string, message: string) => JSON.stringify({ type: "error", error: { type, message } });

  it("classifies onto the existing error classes", () => {
    expect(classifyAnthropic(529, body("overloaded_error", "Overloaded"))).toBe("server_error");
    expect(classifyAnthropic(500, body("api_error", "x"))).toBe("server_error");
    expect(classifyAnthropic(429, body("rate_limit_error", "x"))).toBe("rate_limit");
    expect(classifyAnthropic(400, body("invalid_request_error", "prompt is too long: 1000000 tokens"))).toBe("context_length");
    expect(classifyAnthropic(401, body("authentication_error", "invalid x-api-key"))).toBe("bad_request");
    expect(classifyAnthropic(400, "not json")).toBe("bad_request");
  });

  it("names model_not_found only for a not_found_error about a model", () => {
    expect(anthropicProviderCode(body("not_found_error", "model: claude-nope"))).toBe("model_not_found");
    expect(anthropicProviderCode(body("not_found_error", "resource missing"))).toBe("not_found_error");
    expect(anthropicProviderCode("{}")).toBeNull();
  });
});
