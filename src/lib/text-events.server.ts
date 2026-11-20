/**
 * 20 Nov 2026, Proposal Desk: the public address the text sender posts delivery reports and replies to.
 *
 * Order of work, cheapest first, so a stranger's request costs almost nothing:
 *   1. size and shape of the request, and a limit on how many unsigned requests one caller may make;
 *   2. the signature, over the exact bytes received, with a five minute window on its time;
 *   3. the event's own id, kept so the same event is never acted on twice;
 *   4. the event itself.
 * Nothing is read from the database before the signature is proven. No part of an event is logged: not a number,
 * not the words, not the body.
 */

import { Webhook } from "standardwebhooks";

import { handleTextEvent, type InboundStore, type TextEvent } from "./lead-ask.server";

const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_MS = 60_000;
/** Unsigned or badly signed requests one caller may make in a minute before being turned away unread. */
const BAD_PER_MINUTE = 20;
/** Signed events handled in a minute, across everyone. Far above five firms' use; a flood is asked to come back. */
const GOOD_PER_MINUTE = 600;

export type Limiter = { hit: (key: string, limit: number, now: number) => boolean; over: (key: string, limit: number, now: number) => boolean };

/** A small fixed-window counter held in memory. It limits one running copy of the server; the signature is the real gate. */
export function memoryLimiter(): Limiter {
  const windows = new Map<string, { start: number; count: number }>();
  const current = (key: string, now: number) => {
    const found = windows.get(key);
    if (found && now - found.start < WINDOW_MS) return found;
    if (windows.size > 5000) windows.clear();
    const fresh = { start: now, count: 0 };
    windows.set(key, fresh);
    return fresh;
  };
  return {
    hit(key, limit, now) {
      const window = current(key, now);
      window.count += 1;
      return window.count <= limit;
    },
    over: (key, limit, now) => current(key, now).count >= limit,
  };
}

export type TextEventDeps = {
  secret: () => string | null;
  limiter: Limiter;
  /** Keeps the event's id. "seen" means it was already handled. */
  claim: (id: string) => Promise<"new" | "seen" | "failed">;
  /** Lets go of an id whose event could not be handled, so the sender's retry is taken. */
  release: (id: string) => Promise<void>;
  store: () => Promise<InboundStore>;
  now: () => number;
};

const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

function callerKey(request: Request): string {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "";
  return (forwarded.split(",")[0] ?? "").trim().slice(0, 64) || "unknown";
}

export async function handleTextEventRequest(request: Request, deps: TextEventDeps): Promise<Response> {
  const now = deps.now();
  const caller = `bad:${callerKey(request)}`;
  if (deps.limiter.over(caller, BAD_PER_MINUTE, now)) return reply(429, { error: "slow down" });
  const bad = (status: number, error: string) => {
    deps.limiter.hit(caller, BAD_PER_MINUTE, now);
    return reply(status, { error });
  };

  const secret = deps.secret();
  // Not set up yet: refuse everything, read nothing.
  if (!secret) return bad(503, "not set up");
  const id = request.headers.get("webhook-id") ?? "";
  const timestamp = request.headers.get("webhook-timestamp") ?? "";
  const signature = request.headers.get("webhook-signature") ?? "";
  if (!id || id.length > 200 || !timestamp || !signature) return bad(401, "invalid signature");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return bad(413, "too large");
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return bad(413, "too large");

  let payload: unknown;
  try {
    // Checks the signature over the exact bytes and refuses a time more than five minutes away.
    payload = new Webhook(secret).verify(body, { "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": signature });
  } catch {
    return bad(401, "invalid signature");
  }

  if (!deps.limiter.hit("good", GOOD_PER_MINUTE, now)) return reply(429, { error: "slow down" });
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const type = typeof record["type"] === "string" ? record["type"] : "";
  // The sender's own test event, and anything without a body we know, is acknowledged and left alone.
  if (!type || record["test"] === true || !record["data"] || typeof record["data"] !== "object") return reply(200, { ok: true });
  const event: TextEvent = { type, timestamp: typeof record["timestamp"] === "string" ? record["timestamp"] : null, data: record["data"] as Record<string, unknown> };

  const claimed = await deps.claim(id);
  if (claimed === "seen") return reply(200, { ok: true, seen: true });
  if (claimed === "failed") return reply(503, { error: "try again" });
  let outcome: "done" | "retry";
  try {
    outcome = await handleTextEvent(await deps.store(), event);
  } catch {
    outcome = "retry";
  }
  if (outcome === "retry") {
    await deps.release(id);
    console.error(`[text-events] could not handle ${type.replace(/[^a-z_.]/g, "").slice(0, 40)}, asked for a retry`);
    return reply(503, { error: "try again" });
  }
  return reply(200, { ok: true });
}

const sharedLimiter = memoryLimiter();

export async function realTextEventDeps(): Promise<TextEventDeps> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient;
  return {
    secret: () => {
      const value = (process.env["BIRD_WEBHOOK_SECRET"] ?? "").trim();
      return /^whsec_[A-Za-z0-9+/=_-]{16,}$/.test(value) ? value : null;
    },
    limiter: sharedLimiter,
    async claim(id) {
      const { error } = await admin.from("text_webhook_events").insert({ id });
      if (!error) return "new";
      return (error as { code?: string }).code === "23505" ? "seen" : "failed";
    },
    async release(id) {
      await admin.from("text_webhook_events").delete().eq("id", id);
    },
    store: async () => (await import("./lead-ask.server")).realInboundStore(),
    now: () => Date.now(),
  };
}
