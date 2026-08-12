import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { logHealth } from "./health.server";

export type AiErrorClass =
  | "rate_limit"
  | "timeout"
  | "server_error"
  | "context_length"
  | "refusal"
  | "bad_request"
  | "model_error";

/**
 * The single place any model is called. Every surface goes through here so
 * routing, pricing, usage accounting and health reporting can never drift
 * between them. All calls are OpenAI, server side, with the owner's key.
 */

export type ToolCall = { id: string; name: string; arguments: string };

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

/**
 * Two tiers, named here so the vendor or the model can change in one edit.
 * fast: extracts, summarisation, mapping and lineage rationales.
 * smart: chat answers, decision drafting, analyses.
 */
export type ModelTier = "fast" | "smart";

export const MODELS: Record<ModelTier, string> = {
  fast: "gpt-4.1-mini",
  smart: "gpt-5",
};

/**
 * If a tier's model id is unavailable to this account (OpenAI answers 404 with
 * code `model_not_found`), the same request is retried once against this model.
 * One unavailable model must never take every surface down. The person is not
 * told; this is plumbing, and the health log carries the anomaly.
 */
export const MODEL_FALLBACK: Partial<Record<ModelTier, string>> = {
  smart: "gpt-4.1",
};

/** USD per 1M tokens. One table, one edit when prices move. */
export const MODEL_PRICES: Record<string, { input: number; cachedInput: number; output: number }> =
  {
    "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
    // OpenAI published API pricing for gpt-4.1: 2.00 in / 0.50 cached in / 8.00 out.
    "gpt-4.1": { input: 2, cachedInput: 0.5, output: 8 },
    "gpt-5": { input: 1.25, cachedInput: 0.125, output: 10 },
  };

/** The Batch API is half price. */
export const BATCH_DISCOUNT = 0.5;

export function computeCostUsd(
  model: string,
  tokensIn: number,
  cachedIn: number,
  tokensOut: number,
  batch = false,
): number {
  const price = MODEL_PRICES[model] ?? MODEL_PRICES[MODELS.smart]!;
  const freshIn = Math.max(tokensIn - cachedIn, 0);
  const usd =
    (freshIn * price.input + cachedIn * price.cachedInput + tokensOut * price.output) / 1_000_000;
  return Number((usd * (batch ? BATCH_DISCOUNT : 1)).toFixed(6));
}

/** House style: the em dash is never used in Lasso copy, model output included. */
export function stripEmDashes(text: string): string {
  return text.replace(/\s*\u2014\s*/g, ", ");
}

export type AiMeta = {
  surface: string;
  orgId?: string | null | undefined;
  orgName?: string | null | undefined;
  actorHash?: string | null | undefined;
};

export type ChatResult = {
  text: string;
  toolArgs: string | null;
  /** Every tool call the model asked for, in order. */
  toolCalls: ToolCall[];
  finishReason: "stop" | "length" | "tool_calls" | "other";
  model: string;
  tokensIn: number;
  tokensOut: number;
  cachedIn: number;
  costUsd: number;
  durationMs: number;
};

export type ChatOptions = {
  tier?: ModelTier;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  responseFormat?: Record<string, unknown>;
  tools?: unknown[];
  toolChoice?: unknown;
  meta?: AiMeta;
};

const SLOW_CALL_MS = 20_000;
const DEFAULT_TIMEOUT_MS = 180_000;

export class AiError extends Error {
  errorClass: AiErrorClass;
  constructor(message: string, errorClass: AiErrorClass) {
    super(message);
    this.errorClass = errorClass;
  }
}

function classify(status: number, body: string): AiErrorClass {
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server_error";
  if (/context[_ ]length|maximum context|too many tokens/i.test(body)) return "context_length";
  if (/refus/i.test(body)) return "refusal";
  return "bad_request";
}

/** The provider's own error string, never our request body. */
function providerMessage(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; code?: string } };
    const message = parsed.error?.message;
    if (message) return `${status}: ${message}`.slice(0, 2000);
  } catch {
    // not JSON
  }
  return `${status}`;
}

/** The provider's machine readable error code, when it gave one. */
function providerCode(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string | null } };
    return parsed.error?.code ?? null;
  } catch {
    return null;
  }
}

function friendly(errorClass: AiErrorClass): string {
  switch (errorClass) {
    case "rate_limit":
      return "The model is rate limited right now. Try again in a moment.";
    case "timeout":
      return "That took too long to answer. Try a narrower scope.";
    case "context_length":
      return "That was too much material for one answer. Try a narrower scope.";
    case "server_error":
      return "The model service had a problem. Try again in a moment.";
    case "refusal":
      return "The model declined to answer that.";
    default:
      return "The model request failed. Try again.";
  }
}

function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o[0-9])/.test(model);
}

function buildBody(
  messages: ChatMessage[],
  model: string,
  options: ChatOptions,
  stream: boolean,
): Record<string, unknown> {
  const maxTokens = options.maxTokens ?? 8000;
  const body: Record<string, unknown> = { model, messages };
  if (isReasoningModel(model)) {
    body["max_completion_tokens"] = maxTokens;
    body["reasoning_effort"] = options.reasoningEffort ?? "low";
  } else {
    body["max_tokens"] = maxTokens;
  }
  if (options.responseFormat) body["response_format"] = options.responseFormat;
  if (options.tools) body["tools"] = options.tools;
  if (options.toolChoice) body["tool_choice"] = options.toolChoice;
  if (stream) {
    body["stream"] = true;
    body["stream_options"] = { include_usage: true };
  }
  return body;
}

/**
 * A pasted key often carries a trailing newline, which turns into a confusing
 * 401 that reads like a bad key. Trim at read time. A missing key is logged
 * before throwing, because otherwise it is invisible to the owner.
 */
async function apiKey(surface: string, orgId: string | null | undefined): Promise<string> {
  const key = process.env["OPENAI_API_KEY"]?.trim();
  if (!key) {
    await safeLogHealth({
      kind: "error",
      surface: "config",
      orgId,
      detail: "openai_api_key_missing",
      meta: { error_class: "bad_request", origin_surface: surface },
    });
    throw new AiError("The AI account is not configured yet.", "bad_request");
  }
  return key;
}

/**
 * An awaited health write for error paths. The person is already receiving a
 * failure, so the milliseconds are free, and a logging failure must never
 * replace the real error with a worse one.
 */
async function safeLogHealth(input: Parameters<typeof logHealth>[0]): Promise<void> {
  try {
    await logHealth(input);
  } catch {
    // Never let the health channel mask what actually went wrong.
  }
}

function afterCall(result: ChatResult, meta: AiMeta | undefined): void {
  const surface = meta?.surface ?? "unknown";
  if (result.durationMs > SLOW_CALL_MS) {
    void logHealth({
      kind: "slow",
      surface,
      orgId: meta?.orgId,
      model: result.model,
      latencyMs: result.durationMs,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      detail: "wall clock over slow threshold",
      meta: { slow_threshold_ms: SLOW_CALL_MS, cached_in: result.cachedIn },
    });
  }
  if (result.finishReason === "length") {
    void logHealth({
      kind: "truncated",
      surface,
      orgId: meta?.orgId,
      model: result.model,
      latencyMs: result.durationMs,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      detail: "finish_reason: length",
      meta: { finish_reason: "length" },
    });
  }
}

async function failed(
  errorClass: AiErrorClass,
  model: string,
  startedAt: number,
  meta: AiMeta | undefined,
  note?: string,
  status?: number,
): Promise<never> {
  await safeLogHealth({
    kind: errorClass === "rate_limit" ? "rate_limit" : "error",
    surface: meta?.surface ?? "unknown",
    orgId: meta?.orgId,
    model,
    latencyMs: Date.now() - startedAt,
    detail: note ?? errorClass,
    meta: { error_class: errorClass, ...(status != null ? { http_status: status } : {}) },
  });
  throw new AiError(friendly(errorClass), errorClass);
}

type Attempt =
  | { ok: true; response: Response }
  | { ok: false; kind: "fetch"; name: string }
  | { ok: false; kind: "http"; status: number; body: string };

async function sendRequest(
  model: string,
  messages: ChatMessage[],
  options: ChatOptions,
  stream: boolean,
): Promise<Attempt> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await apiKey(options.meta?.surface ?? "unknown", options.meta?.orgId)}`,
      },
      body: JSON.stringify(buildBody(messages, model, options, stream)),
    });
  } catch (e) {
    return { ok: false, kind: "fetch", name: (e as Error).name };
  }
  if (!response.ok || (stream && !response.body)) {
    const body = response.body ? await response.text() : "";
    return { ok: false, kind: "http", status: response.status, body };
  }
  return { ok: true, response };
}

/**
 * The one hop. Only `model_not_found` on the tier's model, never a malformed
 * body, a 401 or a 403, and never twice.
 */
async function fallbackModelFor(
  attempt: Attempt,
  model: string,
  options: ChatOptions,
): Promise<string | null> {
  if (attempt.ok || attempt.kind !== "http") return null;
  if (classify(attempt.status, attempt.body) !== "bad_request") return null;
  if (providerCode(attempt.body) !== "model_not_found") return null;
  const tier = options.tier ?? "smart";
  if (model !== MODELS[tier]) return null;
  const fallback = MODEL_FALLBACK[tier];
  if (!fallback || fallback === model) return null;
  await safeLogHealth({
    kind: "anomaly",
    surface: "model_fallback",
    orgId: options.meta?.orgId,
    model: fallback,
    detail: "smart_model_unavailable_used_fallback",
    meta: {
      requested_model: model,
      actual_model: fallback,
      tier,
      http_status: attempt.status,
      provider_code: "model_not_found",
      origin_surface: options.meta?.surface ?? "unknown",
    },
  });
  return fallback;
}

function normaliseFinish(raw: string | undefined): ChatResult["finishReason"] {
  if (raw === "stop") return "stop";
  if (raw === "length") return "length";
  if (raw === "tool_calls") return "tool_calls";
  return "other";
}

/** One request, one answer. Usage and cost are always populated. */
export async function chatComplete(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<ChatResult> {
  let model = options.model ?? MODELS[options.tier ?? "smart"];
  const startedAt = Date.now();

  let attempt = await sendRequest(model, messages, options, false);
  const fallback = await fallbackModelFor(attempt, model, options);
  if (fallback) {
    model = fallback;
    attempt = await sendRequest(model, messages, options, false);
  }

  if (!attempt.ok && attempt.kind === "fetch") {
    const name = attempt.name;
    if (name === "TimeoutError" || name === "AbortError") {
      return await failed("timeout", model, startedAt, options.meta);
    }
    return await failed("model_error", model, startedAt, options.meta, name);
  }
  if (!attempt.ok) {
    return await failed(
      classify(attempt.status, attempt.body),
      model,
      startedAt,
      options.meta,
      providerMessage(attempt.body, attempt.status),
      attempt.status,
    );
  }
  const response = attempt.response;

  type Payload = {
    choices?: {
      message?: {
        content?: string;
        tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
      };
      finish_reason?: string;
    }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };
  let payload: Payload;
  try {
    payload = (await response.json()) as Payload;
  } catch {
    // A 200 with a body we cannot parse is still a model request failure.
    return await failed(
      "model_error",
      model,
      startedAt,
      options.meta,
      "response_body_unparseable",
      response.status,
    );
  }
  const choice = payload.choices?.[0];
  const tokensIn = payload.usage?.prompt_tokens ?? 0;
  const tokensOut = payload.usage?.completion_tokens ?? 0;
  const cachedIn = payload.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const result: ChatResult = {
    text: stripEmDashes(choice?.message?.content?.trim() ?? ""),
    toolArgs: choice?.message?.tool_calls?.[0]?.function?.arguments ?? null,
    toolCalls: (choice?.message?.tool_calls ?? []).map((call, index) => ({
      id: call.id ?? `call_${index}`,
      name: call.function?.name ?? "",
      arguments: call.function?.arguments ?? "{}",
    })),
    finishReason: normaliseFinish(choice?.finish_reason),
    model,
    tokensIn,
    tokensOut,
    cachedIn,
    costUsd: computeCostUsd(model, tokensIn, cachedIn, tokensOut),
    durationMs: Date.now() - startedAt,
  };
  afterCall(result, options.meta);
  return result;
}

/**
 * The same call, streamed. Deltas are handed out as they arrive; the complete
 * text and the real usage numbers come back at the end. Whatever arrived before
 * a break is still returned, so a broken stream never silently drops an answer.
 */
export async function streamChat(
  messages: ChatMessage[],
  onDelta: (delta: string) => void | Promise<void>,
  options: ChatOptions = {},
): Promise<ChatResult & { interrupted: boolean }> {
  const model = options.model ?? MODELS[options.tier ?? "smart"];
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify(buildBody(messages, model, options, true)),
    });
  } catch (e) {
    const name = (e as Error).name;
    if (name === "TimeoutError" || name === "AbortError") {
      return await failed("timeout", model, startedAt, options.meta);
    }
    return await failed("model_error", model, startedAt, options.meta, name);
  }

  if (!response.ok || !response.body) {
    const body = response.body ? await response.text() : "";
    return await failed(
      classify(response.status, body),
      model,
      startedAt,
      options.meta,
      providerMessage(body, response.status),
      response.status,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let finish: string | undefined;
  let tokensIn = 0;
  let tokensOut = 0;
  let cachedIn = 0;
  let interrupted = false;
  // Tool calls arrive in fragments, keyed by index, and are reassembled here.
  const toolParts = new Map<number, { id: string; name: string; arguments: string }>();

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
        if (!data || data === "[DONE]") continue;
        let event: {
          choices?: {
            delta?: {
              content?: string;
              tool_calls?: {
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }[];
            };
            finish_reason?: string;
          }[];
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            prompt_tokens_details?: { cached_tokens?: number };
          };
        };
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = event.choices?.[0]?.delta?.content;
        if (delta) {
          text += delta;
          await onDelta(delta);
        }
        for (const part of event.choices?.[0]?.delta?.tool_calls ?? []) {
          const index = part.index ?? 0;
          const existing = toolParts.get(index) ?? { id: "", name: "", arguments: "" };
          toolParts.set(index, {
            id: part.id ?? existing.id,
            name: part.function?.name ?? existing.name,
            arguments: existing.arguments + (part.function?.arguments ?? ""),
          });
        }
        if (event.choices?.[0]?.finish_reason) finish = event.choices[0].finish_reason;
        if (event.usage) {
          tokensIn = event.usage.prompt_tokens ?? tokensIn;
          tokensOut = event.usage.completion_tokens ?? tokensOut;
          cachedIn = event.usage.prompt_tokens_details?.cached_tokens ?? cachedIn;
        }
      }
    }
  } catch (e) {
    interrupted = true;
    console.error("[ai] stream broke:", (e as Error).message);
    void logHealth({
      kind: "error",
      surface: options.meta?.surface ?? "unknown",
      orgId: options.meta?.orgId,
      model,
      latencyMs: Date.now() - startedAt,
      detail: "stream interrupted",
      meta: { error_class: "model_error" },
    });
  }

  const result: ChatResult = {
    text: stripEmDashes(text.trim()),
    toolArgs: [...toolParts.values()][0]?.arguments ?? null,
    toolCalls: [...toolParts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, call]) => ({
        id: call.id || `call_${index}`,
        name: call.name,
        arguments: call.arguments || "{}",
      })),
    finishReason: normaliseFinish(finish),
    model,
    tokensIn,
    tokensOut,
    cachedIn,
    costUsd: computeCostUsd(model, tokensIn, cachedIn, tokensOut),
    durationMs: Date.now() - startedAt,
  };
  afterCall(result, options.meta);
  return { ...result, interrupted };
}

const orgNames = new Map<string, string | null>();

/** Cached org name for reporting. Cheap, and never on the hot path twice. */
export async function orgNameFor(
  supabase: SupabaseClient<Database>,
  orgId: string | null | undefined,
): Promise<string | null> {
  if (!orgId) return null;
  if (orgNames.has(orgId)) return orgNames.get(orgId) ?? null;
  let name: string | null = null;
  try {
    const { data } = await supabase.from("orgs").select("name").eq("id", orgId).maybeSingle();
    name = data?.name ?? null;
  } catch {
    name = null;
  }
  orgNames.set(orgId, name);
  return name;
}

/** Org name and hashed actor for reporting. Never a raw user id, never a name. */
export async function resolveAiMeta(
  supabase: SupabaseClient<Database>,
  input: { surface: string; orgId: string; userId?: string | null | undefined },
): Promise<AiMeta> {
  const orgName = await orgNameFor(supabase, input.orgId);
  const { computeActorHash } = await import("./telemetry.server");
  return {
    surface: input.surface,
    orgId: input.orgId,
    orgName,
    actorHash: await computeActorHash(input.userId),
  };
}
