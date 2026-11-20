/**
 * 19 Nov, Proposal Desk, first live slice: the one place a text leaves the app.
 *
 * Callers hand over a recipient, the words and a key that makes a retry the same send; they get back what happened
 * and nothing else. The provider is a detail of this file, so another channel (email while a number is being
 * approved) can sit beside sendText without its callers changing.
 *
 * Server only. Reads BIRD_API_KEY and BIRD_SMS_FROM. Never logs or returns the recipient, the sender, the
 * words or the provider's reply body: an error line carries a status and a short code and that is all.
 */

export type TextSendResult =
  /** `id` is the sender's own id for the message, used to match delivery reports. Absent when none came back. */
  | { outcome: "accepted"; id?: string | undefined }
  /** The recipient has opted out with the provider (they replied STOP). Only they can reverse it. */
  | { outcome: "opted_out" }
  /** The provider would not take it: a sender not approved for that country, a country switched off, no credit. */
  | { outcome: "refused"; status: number; code: string | null }
  /** Nothing usable came back: a network error, a timeout or a server error. */
  | { outcome: "failed"; status: number | null };

export type TextConfig = { apiKey: string; from: string; host: string };

const KEY_SHAPE = /^bk_(us1|eu1)_[A-Za-z0-9_-]{8,}$/;
const SENDER_SHAPE = /^(\+[1-9]\d{7,14}|[A-Za-z0-9 ._-]{3,11})$/;
const SEND_TIMEOUT_MS = 10_000;
/** The provider's code for a recipient who replied STOP to this sender. */
const SUPPRESSED = /E12077|SMSRecipientSuppressed|E25000|PreferenceRevoked/;

/**
 * The provider's settings, or null when texting is not connected. A key of the wrong shape counts as not connected
 * rather than being tried: the key's own prefix names the region, so no host is ever built from anything else.
 */
export function textConfig(env: Record<string, string | undefined> = process.env): TextConfig | null {
  const apiKey = (env["BIRD_API_KEY"] ?? "").trim();
  const from = (env["BIRD_SMS_FROM"] ?? "").trim();
  const region = KEY_SHAPE.exec(apiKey)?.[1];
  if (!region || !SENDER_SHAPE.test(from)) return null;
  return { apiKey, from, host: `https://${region}.platform.bird.com` };
}

function codeOf(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const nested = record["error"] && typeof record["error"] === "object" ? (record["error"] as Record<string, unknown>) : {};
  for (const value of [record["code"], record["name"], nested["code"], nested["name"]]) {
    // A short name or code, never a run of digits long enough to be a phone number.
    if (typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(value) && !/\d{7,}/.test(value)) return value;
  }
  return null;
}

/** Sends one plain text to one person. Never throws. */
export async function sendText(
  config: TextConfig,
  /** `kind` labels the message for the sender's own reports; `ref` is our id for it, echoed back on delivery reports. */
  message: { to: string; text: string; idempotencyKey: string; kind?: string | undefined; ref?: string | undefined },
  fetchImpl: typeof fetch = fetch,
): Promise<TextSendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${config.host}/v1/sms/messages`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        to: message.to,
        from: config.from,
        text: message.text,
        category: "transactional",
        options: { smart_encoding: true },
        tags: [{ name: "kind", value: message.kind ?? "won_text" }],
        ...(message.ref ? { metadata: { text_id: message.ref } } : {}),
      }),
    });
    if (response.status === 202 || response.status === 200) {
      let id: string | undefined;
      try {
        const body = (await response.json()) as { id?: unknown } | null;
        if (typeof body?.id === "string" && /^[A-Za-z0-9_-]{6,80}$/.test(body.id)) id = body.id;
      } catch {
        /* accepted with no readable body: the text went, only the id is unknown */
      }
      return id ? { outcome: "accepted", id } : { outcome: "accepted" };
    }
    let raw = "";
    try {
      raw = await response.text();
    } catch {
      /* a reply with no readable body is still a refusal with its status */
    }
    if (response.status >= 500) return { outcome: "failed", status: response.status };
    if (SUPPRESSED.test(raw)) return { outcome: "opted_out" };
    let code: string | null = null;
    try {
      code = codeOf(JSON.parse(raw));
    } catch {
      /* not JSON: the status alone is the answer */
    }
    return { outcome: "refused", status: response.status, code };
  } catch {
    return { outcome: "failed", status: null };
  } finally {
    clearTimeout(timer);
  }
}
