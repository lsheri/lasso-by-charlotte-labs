/**
 * KEY-1: the Anthropic Messages API behind the one model seam in ai.server.ts.
 *
 * Pure translation in both directions. Nothing here calls the network: the
 * request builder returns a body, the response readers take JSON or a stream.
 * The chat surface, usage accounting and health reporting stay in ai.server.ts
 * and see the same ChatResult shape whichever provider answered.
 */

import type { AiErrorClass, ChatMessage, ChatOptions, RawCitation, RecordDocument, ToolCall } from "./ai.server";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

/** Below this many characters a system block is not worth a cache breakpoint (about 1,000 tokens). */
export const CACHE_MIN_CHARS = 4000;

/** The forced tool that carries a json_schema response format. */
export const RESPOND_TOOL = "respond";

type TextBlock = { type: "text"; text: string };
type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string };
/** TOTAL-1: a citable document. Plain text is chunked by sentence; custom content keeps our blocks (one per turn). */
type DocumentBlock = {
  type: "document";
  source: { type: "text"; media_type: "text/plain"; data: string } | { type: "content"; content: { type: "text"; text: string }[] };
  title: string;
  context?: string;
  citations: { enabled: true };
};
type CacheControl = { cache_control: { type: "ephemeral" } };
/** IMG-2: an image the model reads. */
type ImageBlock = { type: "image"; source: { type: "base64"; media_type: string; data: string } };
type AnthropicMessage = { role: "user" | "assistant"; content: string | ((TextBlock | ToolUseBlock | ToolResultBlock | DocumentBlock | ImageBlock) & Partial<CacheControl>)[] };

/** TOTAL-1: the blocks a user turn with documents becomes. Exported for tests. */
export function documentBlocks(doc: RecordDocument): DocumentBlock {
  const base = { type: "document" as const, title: doc.title.slice(0, 500), citations: { enabled: true as const }, ...(doc.context ? { context: doc.context.slice(0, 2000) } : {}) };
  if (doc.kind === "conversation") {
    return { ...base, source: { type: "content", content: doc.blocks.map((text) => ({ type: "text" as const, text })) } };
  }
  return { ...base, source: { type: "text", media_type: "text/plain", data: doc.blocks.join("\n\n") } };
}

function markLastAssistant(messages: AnthropicMessage[]): void {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== "assistant") continue;
    if (typeof message.content === "string") {
      if (!message.content) return;
      message.content = [{ type: "text", text: message.content, cache_control: { type: "ephemeral" } }];
    } else if (message.content.length > 0) {
      const last = message.content[message.content.length - 1];
      if (last) last.cache_control = { type: "ephemeral" };
    }
    return;
  }
}

type OpenAiTool = { type?: string; function?: { name?: string; description?: string; parameters?: unknown } };

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

/** OpenAI function tools become Anthropic tools; unknown shapes are passed through untouched. */
export function toAnthropicTools(tools: unknown[] | undefined): Record<string, unknown>[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => {
    const candidate = tool as OpenAiTool;
    if (candidate.type === "function" && candidate.function?.name) {
      return {
        name: candidate.function.name,
        ...(candidate.function.description ? { description: candidate.function.description } : {}),
        input_schema: candidate.function.parameters ?? { type: "object", properties: {} },
      };
    }
    return tool as Record<string, unknown>;
  });
}

export function toAnthropicToolChoice(choice: unknown): Record<string, unknown> | undefined {
  if (choice === undefined || choice === null) return undefined;
  if (choice === "auto") return { type: "auto" };
  if (choice === "required") return { type: "any" };
  if (choice === "none") return { type: "none" };
  const named = choice as { type?: string; function?: { name?: string }; name?: string };
  if (named.type === "function" && named.function?.name) return { type: "tool", name: named.function.name };
  if (named.type === "tool" && named.name) return { type: "tool", name: named.name };
  return { type: "auto" };
}

/**
 * Builds the Messages API body. System messages join into the top-level
 * system string; tool calls and tool results become content blocks; a
 * json_schema response format becomes a forced tool; json_object becomes a
 * system line. Effort passes through output_config.
 */
export function toAnthropicBody(
  messages: ChatMessage[],
  model: string,
  options: ChatOptions,
  stream: boolean,
): Record<string, unknown> {
  const systemParts: string[] = [];
  const out: AnthropicMessage[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      if (message.content) systemParts.push(message.content);
      continue;
    }
    if (message.role === "tool") {
      const block: ToolResultBlock = { type: "tool_result", tool_use_id: message.tool_call_id ?? "", content: message.content };
      const last = out[out.length - 1];
      if (last && last.role === "user" && Array.isArray(last.content) && last.content.every((b) => b.type === "tool_result")) {
        last.content.push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
      continue;
    }
    if (message.role === "assistant" && message.tool_calls && message.tool_calls.length > 0) {
      const blocks: (TextBlock | ToolUseBlock)[] = [];
      if (message.content) blocks.push({ type: "text", text: message.content });
      for (const call of message.tool_calls) {
        blocks.push({ type: "tool_use", id: call.id, name: call.function.name, input: parseArguments(call.function.arguments) });
      }
      out.push({ role: "assistant", content: blocks });
      continue;
    }
    if (message.role === "user" && message.images && message.images.length > 0 && !(message.documents && message.documents.length > 0)) {
      // IMG-2: images first, then the instruction, as the Messages API recommends.
      const blocks: (TextBlock | ImageBlock)[] = message.images.map((image) => ({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } }));
      if (message.content) blocks.push({ type: "text", text: message.content });
      out.push({ role: "user", content: blocks });
      continue;
    }
    if (message.role === "user" && message.documents && message.documents.length > 0) {
      // TOTAL-1: the record. Its text header first, then one citable document
      // per item, with the cache breakpoint on the last document so the whole
      // record is one stable, cached prefix for every question that follows.
      const blocks: (TextBlock | DocumentBlock)[] = [];
      if (message.content) blocks.push({ type: "text", text: message.content });
      for (const doc of message.documents) blocks.push(documentBlocks(doc));
      const last = blocks[blocks.length - 1] as (TextBlock | DocumentBlock) & Partial<CacheControl>;
      last.cache_control = { type: "ephemeral" };
      out.push({ role: "user", content: blocks });
      continue;
    }
    out.push({ role: message.role === "assistant" ? "assistant" : "user", content: message.content });
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? 8000,
    messages: out,
  };

  let tools = toAnthropicTools(options.tools);
  let toolChoice = toAnthropicToolChoice(options.toolChoice);

  const format = options.responseFormat as { type?: string; json_schema?: { schema?: unknown } } | undefined;
  if (format?.type === "json_schema") {
    tools = [
      ...(tools ?? []),
      { name: RESPOND_TOOL, description: "Return the answer in the required shape.", input_schema: format.json_schema?.schema ?? { type: "object" } },
    ];
    toolChoice = { type: "tool", name: RESPOND_TOOL };
  } else if (format?.type === "json_object") {
    systemParts.push("Reply with one JSON object and nothing else.");
  }

  if (systemParts.length > 0) {
    const system = systemParts.join("\n\n");
    // KEY-2: a long system block (board context, rules) is marked cacheable so the
    // next turn on the same board pays the cache-read price for it.
    body["system"] = system.length >= CACHE_MIN_CHARS
      ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
      : system;
  }
  // KEY-2: the last assistant turn is a second breakpoint, so a growing chat
  // re-reads its own earlier turns from cache instead of paying for them again.
  if (out.length >= 3) markLastAssistant(out);
  if (tools) body["tools"] = tools;
  if (toolChoice && tools) body["tool_choice"] = toolChoice;
  if (options.reasoningEffort) {
    body["output_config"] = { effort: options.reasoningEffort === "minimal" ? "low" : options.reasoningEffort };
  }
  if (stream) body["stream"] = true;
  return body;
}

export type AnthropicParsed = {
  text: string;
  toolCalls: ToolCall[];
  finishReason: "stop" | "length" | "tool_calls" | "other";
  servedModel: string;
  tokensIn: number;
  tokensOut: number;
  cachedIn: number;
  /** Tokens written to the cache this call; billed at 1.25x the input price. */
  cacheWriteIn: number;
  /** TOTAL-1: raw citations in answer order; resolved against our documents by the caller. */
  citations: RawCitation[];
};

/** A citation as the API sends it, in a text block or a citations_delta. */
type ApiCitation = {
  type?: string;
  cited_text?: string;
  document_index?: number;
  start_block_index?: number;
  end_block_index?: number;
  start_char_index?: number;
  end_char_index?: number;
};

function rawCitation(c: ApiCitation): RawCitation | null {
  if (typeof c.document_index !== "number" || typeof c.cited_text !== "string") return null;
  return {
    document_index: c.document_index,
    cited_text: c.cited_text,
    ...(typeof c.start_block_index === "number" ? { start_block_index: c.start_block_index } : {}),
    ...(typeof c.end_block_index === "number" ? { end_block_index: c.end_block_index } : {}),
    ...(typeof c.start_char_index === "number" ? { start_char_index: c.start_char_index } : {}),
    ...(typeof c.end_char_index === "number" ? { end_char_index: c.end_char_index } : {}),
  };
}

type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

function tokensInFrom(usage: Usage | undefined): number {
  return (usage?.input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0);
}

export function normaliseStop(raw: string | undefined | null): AnthropicParsed["finishReason"] {
  if (raw === "end_turn" || raw === "stop_sequence") return "stop";
  if (raw === "max_tokens") return "length";
  if (raw === "tool_use") return "tool_calls";
  return "other";
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return match?.[1] ?? trimmed;
}

/**
 * Collapses content blocks into the ChatResult fields. When the respond tool
 * carried a json_schema answer, its input becomes the text and no tool call is
 * reported, so callers that asked for JSON read it where they always did.
 */
function collapse(
  blocks: { text: string[]; tools: ToolCall[] },
  stopReason: string | undefined | null,
  jsonObject: boolean,
): Pick<AnthropicParsed, "text" | "toolCalls" | "finishReason"> {
  const respond = blocks.tools.find((call) => call.name === RESPOND_TOOL);
  if (respond) {
    return { text: respond.arguments, toolCalls: blocks.tools.filter((call) => call.name !== RESPOND_TOOL), finishReason: "stop" };
  }
  const joined = blocks.text.join("");
  return {
    text: jsonObject ? stripFences(joined) : joined,
    toolCalls: blocks.tools,
    finishReason: normaliseStop(stopReason),
  };
}

export function fromAnthropicResponse(payload: unknown, requestedModel: string, options: ChatOptions): AnthropicParsed {
  const json = payload as {
    model?: string;
    stop_reason?: string | null;
    content?: ({ type?: string; text?: string; id?: string; name?: string; input?: unknown; citations?: ApiCitation[] | null })[];
    usage?: Usage;
  };
  const text: string[] = [];
  const tools: ToolCall[] = [];
  const citations: RawCitation[] = [];
  for (const block of json.content ?? []) {
    if (block.type === "text" && typeof block.text === "string") {
      text.push(block.text);
      for (const c of block.citations ?? []) {
        const parsed = rawCitation(c);
        if (parsed) citations.push(parsed);
      }
    }
    if (block.type === "tool_use") tools.push({ id: block.id ?? `toolu_${tools.length}`, name: block.name ?? "", arguments: JSON.stringify(block.input ?? {}) });
  }
  const jsonObject = (options.responseFormat as { type?: string } | undefined)?.type === "json_object";
  return {
    ...collapse({ text, tools }, json.stop_reason, jsonObject),
    servedModel: json.model ?? requestedModel,
    tokensIn: tokensInFrom(json.usage),
    tokensOut: json.usage?.output_tokens ?? 0,
    cachedIn: json.usage?.cache_read_input_tokens ?? 0,
    cacheWriteIn: json.usage?.cache_creation_input_tokens ?? 0,
    citations,
  };
}

/**
 * Reads the SSE stream. Text deltas go to onDelta as they arrive; tool input
 * fragments are reassembled by block index. Whatever arrived before a break
 * is still returned with interrupted set.
 */
export async function readAnthropicStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void | Promise<void>,
  requestedModel: string,
  options: ChatOptions,
): Promise<AnthropicParsed & { interrupted: boolean }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const text: string[] = [];
  const toolParts = new Map<number, { id: string; name: string; json: string }>();
  let stopReason: string | undefined;
  let servedModel = requestedModel;
  let tokensIn = 0;
  let tokensOut = 0;
  let cachedIn = 0;
  let cacheWriteIn = 0;
  let interrupted = false;
  const citations: RawCitation[] = [];
  const jsonObject = (options.responseFormat as { type?: string } | undefined)?.type === "json_object";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        let event: {
          type?: string;
          index?: number;
          message?: { model?: string; usage?: Usage };
          content_block?: { type?: string; id?: string; name?: string };
          delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string | null; citation?: ApiCitation };
          usage?: Usage;
        };
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }
        switch (event.type) {
          case "message_start": {
            if (event.message?.model) servedModel = event.message.model;
            tokensIn = tokensInFrom(event.message?.usage);
            cachedIn = event.message?.usage?.cache_read_input_tokens ?? 0;
            cacheWriteIn = event.message?.usage?.cache_creation_input_tokens ?? 0;
            break;
          }
          case "content_block_start": {
            if (event.content_block?.type === "tool_use") {
              toolParts.set(event.index ?? 0, { id: event.content_block.id ?? "", name: event.content_block.name ?? "", json: "" });
            }
            break;
          }
          case "content_block_delta": {
            if (event.delta?.type === "text_delta" && event.delta.text) {
              // A forced respond tool never streams text, so text deltas are always answer text.
              text.push(event.delta.text);
              await onDelta(event.delta.text);
            } else if (event.delta?.type === "citations_delta" && event.delta.citation) {
              const parsed = rawCitation(event.delta.citation);
              if (parsed) citations.push(parsed);
            } else if (event.delta?.type === "input_json_delta") {
              const existing = toolParts.get(event.index ?? 0) ?? { id: "", name: "", json: "" };
              toolParts.set(event.index ?? 0, { ...existing, json: existing.json + (event.delta.partial_json ?? "") });
            }
            break;
          }
          case "message_delta": {
            if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
            if (event.usage?.output_tokens !== undefined) tokensOut = event.usage.output_tokens;
            if (event.usage?.input_tokens !== undefined) tokensIn = tokensInFrom(event.usage);
            if (event.usage?.cache_read_input_tokens !== undefined) cachedIn = event.usage.cache_read_input_tokens;
            if (event.usage?.cache_creation_input_tokens !== undefined) cacheWriteIn = event.usage.cache_creation_input_tokens;
            break;
          }
          default:
            break;
        }
      }
    }
  } catch (e) {
    interrupted = true;
    console.error("[ai] stream broke:", (e as Error).message);
  }

  const tools: ToolCall[] = [...toolParts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, part]) => ({ id: part.id || `toolu_${index}`, name: part.name, arguments: part.json || "{}" }));

  return {
    ...collapse({ text, tools }, stopReason, jsonObject),
    servedModel,
    tokensIn,
    tokensOut,
    cachedIn,
    cacheWriteIn,
    citations,
    interrupted,
  };
}

/** Anthropic error bodies: { type: "error", error: { type, message } }. */
export function anthropicErrorType(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { type?: string } };
    return parsed.error?.type ?? null;
  } catch {
    return null;
  }
}

export function anthropicErrorMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ?? null;
  } catch {
    return null;
  }
}

/** Maps an Anthropic failure onto the error classes the rest of the app already handles. */
export function classifyAnthropic(status: number, body: string): AiErrorClass {
  const type = anthropicErrorType(body);
  const message = anthropicErrorMessage(body) ?? "";
  if (status === 429 || type === "rate_limit_error") return "rate_limit";
  if (status === 529 || type === "overloaded_error") return "server_error";
  if (status >= 500 || type === "api_error") return "server_error";
  if (/prompt is too long|context[_ ]length|maximum context|too many tokens/i.test(message)) return "context_length";
  if (/refus/i.test(message)) return "refusal";
  return "bad_request";
}

/** "model_not_found" when the request named a model this key cannot reach; otherwise null. */
export function anthropicProviderCode(body: string): string | null {
  const type = anthropicErrorType(body);
  const message = anthropicErrorMessage(body) ?? "";
  if (type === "not_found_error" && /model/i.test(message)) return "model_not_found";
  return type;
}
