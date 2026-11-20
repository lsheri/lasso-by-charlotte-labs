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

import type { SupabaseClient } from "@supabase/supabase-js";

import { SENDER_PAUSE_MS, senderPaused } from "./text-readiness-shared";

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
  if (!region || !SENDER_SHAPE.test(from)) {
    reportNotConnected(env);
    return null;
  }
  return { apiKey, from, host: `https://${region}.platform.bird.com` };
}

/**
 * 20 Nov: why texting is not connected, as setting names and "missing" or "wrong shape" only, never a value. Empty
 * when both settings are usable. This is what told us the live site had no sender while Bird showed no traffic.
 */
export function textConfigGaps(env: Record<string, string | undefined> = process.env): string[] {
  const gaps: string[] = [];
  const apiKey = (env["BIRD_API_KEY"] ?? "").trim();
  const from = (env["BIRD_SMS_FROM"] ?? "").trim();
  if (!apiKey) gaps.push("BIRD_API_KEY missing");
  else if (!KEY_SHAPE.test(apiKey)) gaps.push("BIRD_API_KEY wrong shape");
  if (!from) gaps.push("BIRD_SMS_FROM missing");
  else if (!SENDER_SHAPE.test(from)) gaps.push("BIRD_SMS_FROM wrong shape");
  return gaps;
}

let reported = "";
/** One server log line per running copy (and again if the gaps change), so a quiet sender shows up in the logs. */
function reportNotConnected(env: Record<string, string | undefined>) {
  const line = textConfigGaps(env).join("; ");
  if (!line || line === reported) return;
  reported = line;
  console.warn(`[text-sender] texting is not connected: ${line}`);
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

/*
 * 20 Nov 2026, chat pill Phase 0 (Liam, D-97): ready means able to send. A refusal from the provider pauses sending
 * for SENDER_PAUSE_MS. This copy of the server remembers its own last refusal; the database remembers everyone's,
 * through the lead asks it marked rejected, so another copy of the server learns of it too.
 */
let lastRefusal: number | null = null;

/** Notes that the provider refused a send just now. sendText calls it; tests may too. */
export function noteSenderRefused(nowMs: number = Date.now()): void {
  lastRefusal = nowMs;
}

/** For tests: forget this copy's last refusal. */
export function resetSenderRefusal(): void {
  lastRefusal = null;
}

/**
 * Whether a send was refused in the pause window, by this copy or (from the asks table) by any copy. A table that
 * cannot be read counts as no refusal: the press then tries, and a refusal pauses again.
 */
export async function senderRefusedRecently(admin: SupabaseClient | null, now: Date = new Date()): Promise<boolean> {
  if (senderPaused(lastRefusal, now.getTime())) return true;
  if (!admin) return false;
  try {
    const since = new Date(now.getTime() - SENDER_PAUSE_MS).toISOString();
    const { data, error } = await admin.from("proposal_texts").select("status_at").eq("status", "rejected").gte("status_at", since).order("status_at", { ascending: false }).limit(1);
    if (error) return false;
    const stamp = Date.parse(String((data ?? [])[0]?.status_at ?? ""));
    if (!Number.isFinite(stamp)) return false;
    lastRefusal = Math.max(lastRefusal ?? 0, Math.min(stamp, now.getTime()));
    return senderPaused(lastRefusal, now.getTime());
  } catch {
    return false;
  }
}

/**
 * 20 Nov 2026 (Liam, D-106, Q-101: "Hold until a setting says approved"): the carriers' answer is a setting, not a
 * guess. Until BIRD_NUMBER_APPROVED is "true" (Liam sets it the day the number is accepted), nothing ever reaches the
 * provider: demo workspaces get practice asks and real workspaces record answers by hand. A refusal after that still
 * pauses sending for a while.
 */
export function numberApproved(env: Record<string, string | undefined> = process.env): boolean {
  return (env["BIRD_NUMBER_APPROVED"] ?? "").trim().toLowerCase() === "true";
}

/** The sender's settings only when it can send now: the number approved, settings in place, no refusal just now. */
export async function readyTextConfig(admin: SupabaseClient | null, now: Date = new Date(), env: Record<string, string | undefined> = process.env): Promise<TextConfig | null> {
  if (!numberApproved(env)) return null;
  const config = textConfig(env);
  if (!config) return null;
  return (await senderRefusedRecently(admin, now)) ? null : config;
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
    noteSenderRefused();
    return { outcome: "refused", status: response.status, code };
  } catch {
    return { outcome: "failed", status: null };
  } finally {
    clearTimeout(timer);
  }
}
