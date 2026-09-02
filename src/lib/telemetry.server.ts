import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  effectiveTier,
  engagementBand,
  isoWeekStart,
  shouldNotePresence,
  type DataTier,
} from "./data-consent-shared";
import type { TelemetryDims, TelemetryEvent } from "./telemetry-shared";


/** Publishable project key, safe in source, write-only ingest. */
const POSTHOG_KEY = "phc_mb9PLASteZ87YA6P34n4Mb9Hp9rW3oXXRQvq6qXiy6mw";
const POSTHOG_HOST = "https://us.i.posthog.com";

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** One-way, salted. Never reversible to a user id, never leaves as a raw id. */
export async function computeActorHash(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const salt = process.env["TELEMETRY_SALT"];
  if (!salt) return null;
  return sha256Hex(salt + userId);
}

/** Content-free mirror: hashes and dimensions only. Awaited so the edge runtime
 * does not cancel the request when the handler returns. Never throws. */
export async function mirrorToPostHog(
  eventType: TelemetryEvent,
  actorHash: string | null,
  tenantHash: string,
  dims: TelemetryDims,
): Promise<void> {
  if (!actorHash) {
    console.warn(`[telemetry] mirror skipped for ${eventType}: no actor hash (TELEMETRY_SALT?)`);
    return;
  }
  try {
    const response = await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // A hanging analytics host must never stall a user action.
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: eventType,
        distinct_id: actorHash,
        properties: {
          ...dims,
          $process_person_profile: false,
          $groups: { org: tenantHash },
        },
      }),
    });
    if (!response.ok) {
      console.error(
        `[telemetry] mirror failed for ${eventType}: ${response.status} ${await response.text()}`,
      );
    }
  } catch (e) {
    // Analytics must never surface to the user, but it must never be silent either.
    console.error(`[telemetry] mirror threw for ${eventType}:`, (e as Error).message);
  }
}

/**
 * Anonymous marketing views have no org and no user, so they get a constant
 * tenant bucket and a salted per-view actor hash. Still content-free.
 */
export async function recordAnonymousEvent(
  eventType: TelemetryEvent,
  viewId: string,
  dims: TelemetryDims = {},
): Promise<void> {
  try {
    const tenantHash = await sha256Hex("anonymous");
    const actorHash = await computeActorHash(`anon:${viewId}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("events").insert({
      event_type: eventType,
      schema_version: "v1",
      tenant_hash: tenantHash,
      actor_hash: actorHash,
      dims,
      payload: {},
    });
    if (error)
      console.error(`[telemetry] anonymous insert failed for ${eventType}:`, error.message);
    await mirrorToPostHog(eventType, actorHash, tenantHash, dims);
  } catch (e) {
    console.error("[telemetry] recordAnonymousEvent failed:", (e as Error).message);
  }
}

/**
 * The two consent rows, resolved once per request. Both missing rows fall back
 * to the documented defaults.
 */
type ConsentStamp = { tier: DataTier; ledgerVersion: number };
const consentCache = new Map<string, { at: number; value: ConsentStamp }>();
const CONSENT_TTL_MS = 10_000;

export function resetConsentCache(): void {
  consentCache.clear();
}

export async function resolveConsentStamp(
  supabase: SupabaseClient<Database>,
  orgId: string,
  profileId: string | null,
): Promise<ConsentStamp> {
  const key = `${orgId}|${profileId ?? "none"}`;
  const hit = consentCache.get(key);
  if (hit && Date.now() - hit.at < CONSENT_TTL_MS) return hit.value;
  let value: ConsentStamp = { tier: effectiveTier(null, null), ledgerVersion: 0 };
  try {
    const { data: rows } = await supabase
      .from("data_consent_state")
      .select("scope, tier, ledger_version, profile_id")
      .eq("org_id", orgId);
    const orgRow = (rows ?? []).find((row) => row.scope === "org");
    const userRow = (rows ?? []).find(
      (row) => row.scope === "user" && row.profile_id === profileId,
    );
    value = {
      tier: effectiveTier(orgRow?.tier, userRow?.tier),
      ledgerVersion: Math.max(orgRow?.ledger_version ?? 0, userRow?.ledger_version ?? 0),
    };
  } catch {
    /* a missing row is a default, never an error the person sees */
  }
  consentCache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * The single write path for telemetry: the canonical events row plus the
 * content-free PostHog mirror. Never throws.
 */
export async function recordEvent(
  supabase: SupabaseClient<Database>,
  input: {
    eventType: TelemetryEvent;
    orgId: string;
    userId: string | null | undefined;
    dims?: TelemetryDims;
    profileId?: string | null | undefined;
    sessionId?: string | null | undefined;
    clientSeq?: number | null | undefined;
    /** Words, never dimensions. Egress releases this at 'c' and 'd' only. */
    payload?: Record<string, unknown> | null | undefined;
  },
): Promise<void> {
  try {
    const dims = input.dims ?? {};
    const tenantHash = await sha256Hex(input.orgId);
    const actorHash = await computeActorHash(input.userId);
    const consent = await resolveConsentStamp(supabase, input.orgId, input.profileId ?? null);
    const { error } = await supabase.from("events").insert({
      event_type: input.eventType,
      schema_version: "v2",
      tenant_hash: tenantHash,
      actor_hash: actorHash,
      dims,
      payload: (input.payload ?? {}) as never,
      org_id: input.orgId,
      profile_id: input.profileId ?? null,
      session_id: input.sessionId ?? null,
      client_seq: input.clientSeq ?? null,
      event_uuid: crypto.randomUUID(),
      consent_tier: consent.tier,
      consent_ledger_version: consent.ledgerVersion,
      server_ts: new Date().toISOString(),
    });
    if (error)
      console.error(`[telemetry] canonical insert failed for ${input.eventType}:`, error.message);
    // Nothing leaves the workspace at the lowest level.
    if (consent.tier !== "t0") await mirrorToPostHog(input.eventType, actorHash, tenantHash, dims);
    if (!error) {
      // Post-storage only: the stored row is the source of truth, and the sweep
      // decides for itself what each workspace's chosen level allows to leave.
      const { scheduleEgress } = await import("./egress.server");
      scheduleEgress();
    }

  } catch (e) {
    console.error("[telemetry] recordEvent failed:", (e as Error).message);
  }
}

const presenceNoted = new Map<string, string>();

/** Test seam. */
export function resetPresenceCache(): void {
  presenceNoted.clear();
}

/**
 * One presence row per person per ISO week, written on any authenticated
 * activity. Counts only, banded, never a name or a title.
 */
export async function notePresence(
  supabase: SupabaseClient<Database>,
  input: { orgId: string; profileId: string; userId: string | null | undefined },
): Promise<void> {
  try {
    const week = isoWeekStart();
    if (!shouldNotePresence(presenceNoted.get(input.profileId), week)) return;

    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("event_type", "presence.active")
      .eq("profile_id", input.profileId)
      .eq("dims->>week_start", week)
      .limit(1);
    if ((existing ?? []).length > 0) {
      presenceNoted.set(input.profileId, week);
      return;
    }

    const { count } = await supabase
      .from("engagements")
      .select("id", { count: "exact", head: true })
      .eq("org_id", input.orgId);

    presenceNoted.set(input.profileId, week);
    await recordEvent(supabase, {
      eventType: "presence.active",
      orgId: input.orgId,
      userId: input.userId,
      profileId: input.profileId,
      dims: { week_start: week, engagement_count_band: engagementBand(count ?? 0) },
    });
  } catch (e) {
    console.error("[telemetry] notePresence failed:", (e as Error).message);
  }

}
