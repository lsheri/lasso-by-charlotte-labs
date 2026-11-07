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
 * between them. Calls go to Anthropic by default, OpenAI as the one-hop
 * fallback, always server side, with the owner's keys.
 */

export type ToolCall = { id: string; name: string; arguments: string };

/** KEY-3: a picture attached to a user turn. Text stays in `content`; images ride alongside. */
export type ChatImagePart = {
  type: "image";
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  /** Base64, no data: prefix. */
  data: string;
  /** Where it came from, for the manifest; never sent to the model. */
  nodeId?: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** KEY-3: images on a user turn. Ignored on other roles. */
  images?: ChatImagePart[];
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

/**
 * Two tiers, named here so the vendor or the model can change in one edit.
 * fast: extracts, summarisation, mapping and lineage rationales.
 * smart: chat answers, decision drafting, analyses.
 */
export type ModelTier = "fast" | "smart";

/**
 * KEY-1: which vendor answers. Anthropic when its key is present, unless
 * AI_PROVIDER says openai. OpenAI remains the one-hop fallback when an
 * Anthropic request cannot be made or the service itself fails.
 */
export type Provider = "anthropic" | "openai";

export function providerFor(env: Record<string, string | undefined>): Provider {
  if (env["AI_PROVIDER"]?.trim().toLowerCase() === "openai") return "openai";
  return env["ANTHROPIC_API_KEY"]?.trim() ? "anthropic" : "openai";
}

export const PROVIDER_MODELS: Record<Provider, Record<ModelTier, string>> = {
  anthropic: { fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5" },
  openai: { fast: "gpt-4.1-mini", smart: "gpt-5" },
};

/**
 * If a tier's model id is unavailable to this account (the vendor answers
 * `model_not_found`), the same request is retried once against this model.
 * One unavailable model must never take every surface down. The person is not
 * told; this is plumbing, and the health log carries the anomaly.
 */
export const PROVIDER_MODEL_FALLBACK: Record<Provider, Partial<Record<ModelTier, string>>> = {
  anthropic: { smart: "claude-haiku-5-5" },
  openai: { smart: "gpt-4.1" },
};

/** The active provider, read from the environment at call time so a test or a deploy can switch it. */
export function activeProvider(): Provider {
  return providerFor(process.env);
}

/** The tier table for the active provider. Getters, so `MODELS.fast` always reflects the environment. */
export const MODELS: Record<ModelTier, string> = {
  get fast() {
    return PROVIDER_MODELS[activeProvider()].fast;
  },
  get smart() {
    return PROVIDER_MODELS[activeProvider()].smart;
  },
};
export const MODEL_FALLBACK: { readonly [tier in ModelTier]?: string | undefined } = {
  get smart() {
    return PROVIDER_MODEL_FALLBACK[activeProvider()].smart;
  },
};

export function modelFor(tier: ModelTier, provider: Provider = activeProvider()): string {
  return PROVIDER_MODELS[provider][tier];
}

/** USD per 1M tokens. One table, one edit when prices move. */
export const MODEL_PRICES: Record<string, { input: number; cachedInput: number; output: number }> =
  {
    "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
    // OpenAI published API pricing for gpt-4.1: 2.00 in / 0.50 cached in / 8.00 out.
    "gpt-4.1": { input: 2, cachedInput: 0.5, output: 8 },
    "gpt-5": { input: 1.25, cachedInput: 0.125, output: 10 },
    // Anthropic list prices, Nov 2026. Cache reads: 10% of input on Haiku, 5% on Sonnet and Opus.
    "claude-haiku-5-5": { input: 0.1, cachedInput: 0.01, output: 0.5 },
    "claude-sonnet-5-5": { input: 2, cachedInput: 0.1, output: 10 },
    "claude-opus-5-5": { input: 4, cachedInput: 0.2, output: 20 },
  };

/** The Batch API is half price. */
export const BATCH_DISCOUNT = 0.5;

/**
 * The price key for a model id. OpenAI resolves an alias to a dated snapshot,
 * so `gpt-5-2025-08-07` must price as `gpt-5`. Longest matching key wins, so a
 * future `gpt-5-mini` entry is never shadowed by `gpt-5`. Null means the model
 * is not in the table and any cost computed for it is a guess.
 */
export function priceKeyFor(model: string): string | null {
  if (MODEL_PRICES[model]) return model;
  let best: string | null = null;
  for (const key of Object.keys(MODEL_PRICES)) {
    if (model.startsWith(key) && (best === null || key.length > best.length)) best = key;
  }
  return best;
}

export function computeCostUsd(
  model: string,
  tokensIn: number,
  cachedIn: number,
  tokensOut: number,
  batch = false,
): number {
  const price = MODEL_PRICES[priceKeyFor(model) ?? MODELS.smart]!;
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
  /** Present only where the caller has an authenticated identity to attribute. */
  userId?: string | null | undefined;
  profileId?: string | null | undefined;
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
  // KEY-3: a user turn with images becomes OpenAI content parts; everything else is sent as is.
  const wire = messages.map((message) => {
    if (message.role !== "user" || !message.images || message.images.length === 0) {
      const { images: _images, ...rest } = message;
      void _images;
      return rest;
    }
    const { images, ...rest } = message;
    return {
      ...rest,
      content: [
        ...images.map((image) => ({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.data}` } })),
        { type: "text", text: message.content },
      ],
    };
  });
  const body: Record<string, unknown> = { model, messages: wire };
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
 *
 * A school workspace uses its own key when one is configured, and the default
 * key when it is not. openAiKeyFor holds that single decision.
 */
async function apiKey(surface: string, orgId: string | null | undefined, provider: Provider): Promise<string> {
  const keys = await import("./ai-key");
  const { orgTypeOf } = await import("./org-type.server");
  const orgType = await orgTypeOf(orgId);
  const selected = provider === "anthropic" ? keys.anthropicKeyFor(orgType, process.env) : keys.openAiKeyFor(orgType, process.env);
  if (!selected) {
    await safeLogHealth({
      kind: "error",
      surface: "config",
      orgId,
      detail: provider === "anthropic" ? "anthropic_api_key_missing" : "openai_api_key_missing",
      meta: { error_class: "bad_request", origin_surface: surface },
    });
    throw new AiError("The AI account is not configured yet.", "bad_request");
  }
  return selected.key;
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

/** The row S8 writes. Exported so the guard test can assert its keys. */
export function aiUsageRow(result: ChatResult, meta: AiMeta | undefined) {
  return {
    org_id: meta?.orgId ?? null,
    profile_id: meta?.profileId ?? null,
    surface: meta?.surface ?? "unknown",
    model: result.model,
    tokens_in: result.tokensIn,
    cached_in: result.cachedIn,
    tokens_out: result.tokensOut,
    cost_usd: result.costUsd,
    duration_ms: result.durationMs,
    finish_reason: result.finishReason,
  };
}

/**
 * Unit S8: the per-call cost record. ai_costs_daily is platform level and
 * cannot say what one workspace costs. This is the same number ChatResult
 * already computed, written down against the workspace.
 *
 * Carries the workspace and the person, so cost can be read per person as
 * well as per workspace. Founder-facing accounting only: a person-level cost
 * is never shown on a partner, firm or member surface. Still deliberately no
 * actor hash, no user id, no org name and no text of any kind.
 * unitS8-ai-usage.test.ts asserts that stays true.
 */
export async function recordUsage(result: ChatResult, meta: AiMeta | undefined): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (meta?.orgId) {
      const orgId = meta.orgId;
      // Detached from accounting and the AI response; the existing mirror preserves dims exactly.
      void (async () => {
        try {
          const { recordEvent } = await import("./telemetry.server");
          await recordEvent(supabaseAdmin, {
            eventType: "ai.usage",
            orgId,
            userId: meta.userId,
            profileId: meta.profileId,
            dims: {
              surface: meta.surface,
              model: result.model,
              cost_usd: result.costUsd,
              tokens_in: result.tokensIn,
              tokens_out: result.tokensOut,
              cached_in: result.cachedIn,
              duration_ms: result.durationMs,
              finish_reason: result.finishReason,
            },
          });
        } catch {
          // A mirror failure must never affect accounting or the caller.
        }
      })();
    }
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    await db.from("ai_usage").insert(aiUsageRow(result, meta));
  } catch {
    // Accounting must never surface as a failure in front of someone.
  }
}

function afterCall(result: ChatResult, meta: AiMeta | undefined): void {
  void recordUsage(result, meta);
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
  provider: Provider,
): Promise<Attempt> {
  let response: Response;
  try {
    const key = await apiKey(options.meta?.surface ?? "unknown", options.meta?.orgId, provider);
    if (provider === "anthropic") {
      const { ANTHROPIC_URL, ANTHROPIC_VERSION, toAnthropicBody } = await import("./anthropic.server");
      response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(toAnthropicBody(messages, model, options, stream)),
      });
    } else {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(buildBody(messages, model, options, stream)),
      });
    }
  } catch (e) {
    if (e instanceof AiError) throw e;
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
  provider: Provider,
): Promise<string | null> {
  if (attempt.ok || attempt.kind !== "http") return null;
  if (provider === "anthropic") {
    const { classifyAnthropic, anthropicProviderCode } = await import("./anthropic.server");
    if (classifyAnthropic(attempt.status, attempt.body) !== "bad_request") return null;
    if (anthropicProviderCode(attempt.body) !== "model_not_found") return null;
  } else {
    if (classify(attempt.status, attempt.body) !== "bad_request") return null;
    if (providerCode(attempt.body) !== "model_not_found") return null;
  }
  const tier = options.tier ?? "smart";
  if (model !== PROVIDER_MODELS[provider][tier]) return null;
  const fallback = PROVIDER_MODEL_FALLBACK[provider][tier];
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
  // The canonical record of a substitution, when the caller carries identity.
  if (options.meta?.userId) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { recordEventV2 } = await import("./telemetry-v2.server");
      await recordEventV2(supabaseAdmin, options.meta.userId, {
        eventName: "model.substituted",
        props: { requested_tier: tier, served_model: fallback },
        profileId: options.meta.profileId ?? null,
      });
    } catch {
      // Plumbing. A substitution is never worth an error in front of someone.
    }
  }
  return fallback;
}

/**
 * KEY-1: one hop from Anthropic to OpenAI when the request never got an answer
 * (network, timeout excluded) or the service itself failed (5xx, 529). A 4xx is
 * our fault or our account's and never falls back.
 */
function providerFallbackWanted(attempt: Attempt, provider: Provider): boolean {
  if (attempt.ok || provider !== "anthropic") return false;
  if (attempt.kind === "fetch") return attempt.name !== "TimeoutError" && attempt.name !== "AbortError";
  return attempt.status >= 500;
}

type Routed = { attempt: Attempt; model: string; provider: Provider };

/** Sends with the active provider, applies the model hop, then the provider hop. */
async function routedRequest(
  requestedModel: string | undefined,
  messages: ChatMessage[],
  options: ChatOptions,
  stream: boolean,
): Promise<Routed> {
  let provider: Provider = activeProvider();
  let model = requestedModel ?? modelFor(options.tier ?? "smart", provider);
  let attempt = await sendRequest(model, messages, options, stream, provider);
  const fallback = await fallbackModelFor(attempt, model, options, provider);
  if (fallback) {
    model = fallback;
    attempt = await sendRequest(model, messages, options, stream, provider);
  }
  if (providerFallbackWanted(attempt, provider) && !requestedModel?.startsWith("gpt")) {
    const tier = options.tier ?? "smart";
    const next = modelFor(tier, "openai");
    await safeLogHealth({
      kind: "anomaly",
      surface: "model_fallback",
      orgId: options.meta?.orgId,
      model: next,
      detail: "provider_unavailable_used_fallback",
      meta: {
        requested_model: model,
        actual_model: next,
        tier,
        provider_fallback: "openai",
        ...(attempt.ok ? {} : attempt.kind === "http" ? { http_status: attempt.status } : { fetch_error: attempt.name }),
        origin_surface: options.meta?.surface ?? "unknown",
      },
    });
    provider = "openai";
    model = next;
    attempt = await sendRequest(model, messages, options, stream, provider);
  }
  return { attempt, model, provider };
}

/** KEY-2: Anthropic bills cache writes at 1.25x input. The extra quarter on top of what computeCostUsd already charged. */
export function cacheWriteUsd(model: string, cacheWriteIn: number): number {
  if (cacheWriteIn <= 0) return 0;
  const key = priceKeyFor(model);
  if (!key) return 0;
  const price = MODEL_PRICES[key];
  if (!price) return 0;
  return (cacheWriteIn / 1_000_000) * price.input * 0.25;
}

function notePricing(servedModel: string, meta: AiMeta | undefined): void {
  if (priceKeyFor(servedModel) !== null) return;
  void logHealth({
    kind: "anomaly",
    surface: "pricing",
    orgId: meta?.orgId,
    model: servedModel,
    detail: "model_not_in_price_table",
    meta: { origin_surface: meta?.surface ?? "unknown" },
  });
}

function failureClass(attempt: Extract<Attempt, { kind: "http" }>, provider: Provider): Promise<AiErrorClass> {
  if (provider === "anthropic") {
    return import("./anthropic.server").then(({ classifyAnthropic }) => classifyAnthropic(attempt.status, attempt.body));
  }
  return Promise.resolve(classify(attempt.status, attempt.body));
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
  const startedAt = Date.now();
  const { attempt, model, provider } = await routedRequest(options.model, messages, options, false);

  if (!attempt.ok && attempt.kind === "fetch") {
    const name = attempt.name;
    if (name === "TimeoutError" || name === "AbortError") {
      return await failed("timeout", model, startedAt, options.meta);
    }
    return await failed("model_error", model, startedAt, options.meta, name);
  }
  if (!attempt.ok) {
    return await failed(
      await failureClass(attempt, provider),
      model,
      startedAt,
      options.meta,
      providerMessage(attempt.body, attempt.status),
      attempt.status,
    );
  }
  const response = attempt.response;

  if (provider === "anthropic") {
    const { fromAnthropicResponse } = await import("./anthropic.server");
    let parsed: ReturnType<typeof fromAnthropicResponse>;
    try {
      parsed = fromAnthropicResponse(await response.json(), model, options);
    } catch {
      return await failed("model_error", model, startedAt, options.meta, "response_body_unparseable", response.status);
    }
    const result: ChatResult = {
      text: stripEmDashes(parsed.text.trim()),
      toolArgs: parsed.toolCalls[0]?.arguments ?? null,
      toolCalls: parsed.toolCalls,
      finishReason: parsed.finishReason,
      model: parsed.servedModel,
      tokensIn: parsed.tokensIn,
      tokensOut: parsed.tokensOut,
      cachedIn: parsed.cachedIn,
      costUsd: computeCostUsd(parsed.servedModel, parsed.tokensIn, parsed.cachedIn, parsed.tokensOut) + cacheWriteUsd(parsed.servedModel, parsed.cacheWriteIn),
      durationMs: Date.now() - startedAt,
    };
    notePricing(result.model, options.meta);
    afterCall(result, options.meta);
    return result;
  }

  type Payload = {
    model?: string;
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
  const servedModel = payload.model ?? model;
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
    model: servedModel,
    tokensIn,
    tokensOut,
    cachedIn,
    costUsd: computeCostUsd(servedModel, tokensIn, cachedIn, tokensOut),
    durationMs: Date.now() - startedAt,
  };
  if (priceKeyFor(servedModel) === null) {
    void logHealth({
      kind: "anomaly",
      surface: "pricing",
      orgId: options.meta?.orgId,
      model: servedModel,
      detail: "model_not_in_price_table",
      meta: { origin_surface: options.meta?.surface ?? "unknown" },
    });
  }
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
  const startedAt = Date.now();
  const { attempt, model, provider } = await routedRequest(options.model, messages, options, true);

  if (!attempt.ok && attempt.kind === "fetch") {
    const name = attempt.name;
    if (name === "TimeoutError" || name === "AbortError") {
      return await failed("timeout", model, startedAt, options.meta);
    }
    return await failed("model_error", model, startedAt, options.meta, name);
  }
  if (!attempt.ok) {
    return await failed(
      await failureClass(attempt, provider),
      model,
      startedAt,
      options.meta,
      providerMessage(attempt.body, attempt.status),
      attempt.status,
    );
  }
  const response = attempt.response;
  if (!response.body) {
    return await failed("model_error", model, startedAt, options.meta, "missing_response_body");
  }

  if (provider === "anthropic") {
    const { readAnthropicStream } = await import("./anthropic.server");
    const parsed = await readAnthropicStream(response.body, onDelta, model, options);
    if (parsed.interrupted) {
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
      text: stripEmDashes(parsed.text.trim()),
      toolArgs: parsed.toolCalls[0]?.arguments ?? null,
      toolCalls: parsed.toolCalls,
      finishReason: parsed.finishReason,
      model: parsed.servedModel,
      tokensIn: parsed.tokensIn,
      tokensOut: parsed.tokensOut,
      cachedIn: parsed.cachedIn,
      costUsd: computeCostUsd(parsed.servedModel, parsed.tokensIn, parsed.cachedIn, parsed.tokensOut) + cacheWriteUsd(parsed.servedModel, parsed.cacheWriteIn),
      durationMs: Date.now() - startedAt,
    };
    notePricing(result.model, options.meta);
    afterCall(result, options.meta);
    return { ...result, interrupted: parsed.interrupted };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let finish: string | undefined;
  let tokensIn = 0;
  let tokensOut = 0;
  let cachedIn = 0;
  let servedModel = model;
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
          model?: string;
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
        if (event.model) servedModel = event.model;
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
    model: servedModel,
    tokensIn,
    tokensOut,
    cachedIn,
    costUsd: computeCostUsd(servedModel, tokensIn, cachedIn, tokensOut),
    durationMs: Date.now() - startedAt,
  };
  if (priceKeyFor(servedModel) === null) {
    void logHealth({
      kind: "anomaly",
      surface: "pricing",
      orgId: options.meta?.orgId,
      model: servedModel,
      detail: "model_not_in_price_table",
      meta: { origin_surface: options.meta?.surface ?? "unknown" },
    });
  }
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
  input: {
    surface: string;
    orgId: string;
    userId?: string | null | undefined;
    profileId?: string | null | undefined;
  },
): Promise<AiMeta> {
  const orgName = await orgNameFor(supabase, input.orgId);
  const { computeActorHash } = await import("./telemetry.server");
  return {
    surface: input.surface,
    orgId: input.orgId,
    orgName,
    userId: input.userId ?? null,
    profileId: input.profileId ?? null,
    actorHash: await computeActorHash(input.userId),
  };
}
