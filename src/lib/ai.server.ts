import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { reportAiHealth, type AiErrorClass } from "./ai-health.server";

/**
 * The single place any model is called. Every surface goes through here so
 * routing, pricing, usage accounting and health reporting can never drift
 * between them. All calls are OpenAI, server side, with the owner's key.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

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

/** USD per 1M tokens. One table, one edit when prices move. */
export const MODEL_PRICES: Record<string, { input: number; cachedInput: number; output: number }> =
  {
    "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
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

const SLOW_CALL_MS = 30_000;
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

function apiKey(): string {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new AiError("The AI account is not configured yet.", "bad_request");
  return key;
}

async function afterCall(result: ChatResult, meta: AiMeta | undefined): Promise<void> {
  const surface = meta?.surface ?? "unknown";
  if (result.durationMs > SLOW_CALL_MS) {
    await reportAiHealth({
      errorClass: "slow_call",
      surface,
      orgId: meta?.orgId,
      orgName: meta?.orgName,
      actorHash: meta?.actorHash,
      model: result.model,
      durationMs: result.durationMs,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      cachedIn: result.cachedIn,
      costUsd: result.costUsd,
    });
  }
  if (result.finishReason === "length") {
    await reportAiHealth({
      errorClass: "finish_length",
      surface,
      orgId: meta?.orgId,
      orgName: meta?.orgName,
      actorHash: meta?.actorHash,
      model: result.model,
      durationMs: result.durationMs,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      cachedIn: result.cachedIn,
      costUsd: result.costUsd,
    });
  }
}

async function failed(
  errorClass: AiErrorClass,
  model: string,
  startedAt: number,
  meta: AiMeta | undefined,
  note?: string,
): Promise<never> {
  await reportAiHealth({
    errorClass,
    surface: meta?.surface ?? "unknown",
    orgId: meta?.orgId,
    orgName: meta?.orgName,
    actorHash: meta?.actorHash,
    model,
    durationMs: Date.now() - startedAt,
    note: note ?? null,
  });
  throw new AiError(friendly(errorClass), errorClass);
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
      body: JSON.stringify(buildBody(messages, model, options, false)),
    });
  } catch (e) {
    const name = (e as Error).name;
    if (name === "TimeoutError" || name === "AbortError") {
      return await failed("timeout", model, startedAt, options.meta);
    }
    return await failed("model_error", model, startedAt, options.meta, name);
  }

  if (!response.ok) {
    const body = await response.text();
    return await failed(
      classify(response.status, body),
      model,
      startedAt,
      options.meta,
      String(response.status),
    );
  }

  const payload = (await response.json()) as {
    choices?: {
      message?: { content?: string; tool_calls?: { function?: { arguments?: string } }[] };
      finish_reason?: string;
    }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };
  const choice = payload.choices?.[0];
  const tokensIn = payload.usage?.prompt_tokens ?? 0;
  const tokensOut = payload.usage?.completion_tokens ?? 0;
  const cachedIn = payload.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const result: ChatResult = {
    text: stripEmDashes(choice?.message?.content?.trim() ?? ""),
    toolArgs: choice?.message?.tool_calls?.[0]?.function?.arguments ?? null,
    finishReason: normaliseFinish(choice?.finish_reason),
    model,
    tokensIn,
    tokensOut,
    cachedIn,
    costUsd: computeCostUsd(model, tokensIn, cachedIn, tokensOut),
    durationMs: Date.now() - startedAt,
  };
  await afterCall(result, options.meta);
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
      String(response.status),
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
          choices?: { delta?: { content?: string }; finish_reason?: string }[];
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
    await reportAiHealth({
      errorClass: "model_error",
      surface: options.meta?.surface ?? "unknown",
      orgId: options.meta?.orgId,
      orgName: options.meta?.orgName,
      actorHash: options.meta?.actorHash,
      model,
      durationMs: Date.now() - startedAt,
      note: "stream interrupted",
    });
  }

  const result: ChatResult = {
    text: stripEmDashes(text.trim()),
    toolArgs: null,
    finishReason: normaliseFinish(finish),
    model,
    tokensIn,
    tokensOut,
    cachedIn,
    costUsd: computeCostUsd(model, tokensIn, cachedIn, tokensOut),
    durationMs: Date.now() - startedAt,
  };
  await afterCall(result, options.meta);
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
