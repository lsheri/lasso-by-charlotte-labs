/** One place where the gateway is called, so every surface behaves the same. */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatResult = {
  text: string;
  finishReason: "stop" | "length" | "other";
  tokensIn: number;
  tokensOut: number;
};

/** google/gemini-2.5-pro list price, USD per token. Used only for run costing. */
const RATE_IN = 1.25 / 1_000_000;
const RATE_OUT = 10 / 1_000_000;

export function estimateCostUsd(tokensIn: number, tokensOut: number): number {
  return Number((tokensIn * RATE_IN + tokensOut * RATE_OUT).toFixed(6));
}

/** House style: the em dash is never used in Lasso copy, model output included. */
export function stripEmDashes(text: string): string {
  return text.replace(/\s*\u2014\s*/g, ", ");
}

export async function chatComplete(
  messages: ChatMessage[],
  options?: { model?: string; maxTokens?: number; timeoutMs?: number },
): Promise<ChatResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  let response: Response;
  try {
    response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(options?.timeoutMs ?? 180_000),
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: options?.model ?? "google/gemini-2.5-pro",
        max_tokens: options?.maxTokens ?? 8000,
        messages,
      }),
    });
  } catch (e) {
    if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") {
      throw new Error("That took too long to answer. Try a narrower scope.");
    }
    throw e;
  }

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429) throw new Error("Rate limited. Try again in a moment.");
    if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const raw = payload.choices?.[0]?.finish_reason ?? "stop";
  return {
    text: stripEmDashes(payload.choices?.[0]?.message?.content?.trim() ?? ""),
    finishReason: raw === "stop" ? "stop" : raw === "length" ? "length" : "other",
    tokensIn: payload.usage?.prompt_tokens ?? 0,
    tokensOut: payload.usage?.completion_tokens ?? 0,
  };
}