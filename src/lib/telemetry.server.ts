import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  effectiveTier,
  engagementBand,
  isoWeekStart,
  shouldNotePresence,
  type DataTier,
} from "./data-consent-shared";
import { getRequestHeader } from "@tanstack/react-start/server";

import { resolveEnvironment } from "./environment.server";
import type { TelemetryDims, TelemetryEvent } from "./telemetry-shared";


/** Publishable project key, safe in source, write-only ingest. */
export const POSTHOG_KEY = "phc_mb9PLASteZ87YA6P34n4Mb9Hp9rW3oXXRQvq6qXiy6mw";
export const POSTHOG_HOST = "https://us.i.posthog.com";

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

/**
 * PH-S1: request and workspace context carried beside the dims. Dims are never
 * altered. The signed-in path sends no IP and disables geo lookup on purpose.
 */
export type MirrorContext = {
  environment: string;
  workspace_type: string;
  affiliated: boolean | null;
  partner: string;
  /** PH-S2: set on recordEvent mirrors only; the anonymous path never sends it. */
  actor_kind?: "person" | "system";
  /** A-S2: mirror only. Never stamped on the events row. */
  account_stage?: string;
  /** Anonymous path only: sends $ip and drops $groups. */
  anonymous?: boolean;
};

function readHeader(name: string): string | undefined {
  try {
    const value = getRequestHeader(name);
    return typeof value === "string" && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function contextProperties(context: MirrorContext): Record<string, unknown> {
  const props: Record<string, unknown> = {
    environment: context.environment,
    workspace_type: context.workspace_type,
    affiliated: context.affiliated,
    partner: context.partner,
  };
  if (context.actor_kind) props["actor_kind"] = context.actor_kind;
  if (context.account_stage) props["account_stage"] = context.account_stage;
  const ua = readHeader("user-agent");
  if (ua) props["$raw_user_agent"] = ua.slice(0, 512);
  if (context.anonymous) {
    const ip = readHeader("cf-connecting-ip") ?? readHeader("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip) props["$ip"] = ip;
  } else {
    props["$geoip_disable"] = true;
  }
  return props;
}

/** Content-free mirror: hashes and dimensions only. Awaited so the edge runtime
 * does not cancel the request when the handler returns. Never throws. */
export async function mirrorToPostHog(
  eventType: TelemetryEvent,
  actorHash: string | null,
  tenantHash: string,
  dims: TelemetryDims,
  context?: MirrorContext,
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
          ...(context ? contextProperties(context) : {}),
          ...dims,
          $process_person_profile: false,
          ...(context?.anonymous ? {} : { $groups: { org: tenantHash } }),
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
 * Unit D7: join the anonymous signup funnel to the account, once, at sign-up.
 *
 * Exempt from the "every custom event goes through logEvent" rule because an
 * alias is not a custom event: it is PostHog's identity merge instruction
 * ($create_alias), it carries no dimensions, and it writes nothing to the
 * events table. It goes out through the same server ingest as the mirror, so
 * this file stays the one server place that talks to PostHog.
 *
 * The anonymous side is the same salted hash recordAnonymousEvent already
 * sends (computeActorHash(`anon:${visitorId}`)). The raw visitor id is used
 * only in memory to recompute it and is never stored. The account side is the
 * auth user id the browser already identifies with. Idempotent at PostHog:
 * re-aliasing the same pair is a no-op. Never throws.
 */
export async function aliasAnonymousVisitor(visitorId: string, userId: string): Promise<boolean> {
  try {
    if (!visitorId || !userId) return false;
    const anonHash = await computeActorHash(`anon:${visitorId}`);
    if (!anonHash) return false;
    const response = await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: "$create_alias",
        distinct_id: userId,
        properties: { alias: anonHash },
      }),
    });
    if (!response.ok) {
      console.error(`[telemetry] alias failed: ${response.status} ${await response.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[telemetry] alias threw:", (e as Error).message);
    return false;
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
  visitorId?: string,
): Promise<void> {
  try {
    const tenantHash = await sha256Hex("anonymous");
    // Unit D6: a stable browser visitor id, when sent, replaces the per-view id.
    const actorHash = await computeActorHash(`anon:${visitorId || viewId}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("events").insert({
      // This path has no org: an anonymous marketing view.
      workspace_type: "none",
      affiliated: null,
      environment: resolveEnvironment(),
      event_type: eventType,
      schema_version: "v1",
      tenant_hash: tenantHash,
      actor_hash: actorHash,
      dims,
      payload: {},
    });
    if (error)
      console.error(`[telemetry] anonymous insert failed for ${eventType}:`, error.message);
    await mirrorToPostHog(eventType, actorHash, tenantHash, dims, {
      environment: resolveEnvironment(),
      workspace_type: "none",
      affiliated: null,
      partner: "none",
      anonymous: true,
    });
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
    // A stamped "unknown" is better than an event that never records.
    let stamp: import("./org-type.server").WorkspaceStamp = {
      workspace_type: "unknown",
      affiliated: null,
    };
    try {
      const { workspaceStamp } = await import("./org-type.server");
      stamp = await workspaceStamp(input.orgId);
    } catch {
      /* keep the "unknown" fallback */
    }
    const { error } = await supabase.from("events").insert({
      ...stamp,
      environment: resolveEnvironment(),
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
    if (consent.tier !== "t0") {
      let partner = "none";
      if (stamp.affiliated === true) {
        try {
          const { partnerSlugOf } = await import("./org-type.server");
          partner = (await partnerSlugOf(input.orgId)) ?? "none";
        } catch {
          /* keep "none" */
        }
      }
      // A-S2: mirror-only context. Never part of the stamp or the insert.
      let accountStage: string | null = null;
      try {
        const { accountStageOf } = await import("./org-type.server");
        accountStage = await accountStageOf(input.orgId);
      } catch {
        /* keep null */
      }
      // PH-S2: a system event (no signed-in user) still mirrors, under a
      // stand-in distinct id. The events row keeps actor_hash null either way.
      const mirrorActorHash = actorHash ?? (await computeActorHash(`system:${input.orgId}`));
      const actorKind = actorHash ? ("person" as const) : ("system" as const);
      if (mirrorActorHash) {
        await mirrorToPostHog(input.eventType, mirrorActorHash, tenantHash, dims, {
          environment: resolveEnvironment(),
          workspace_type: stamp.workspace_type,
          affiliated: stamp.affiliated,
          partner,
          actor_kind: actorKind,
          ...(accountStage ? { account_stage: accountStage } : {}),
        });
      }
    }
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
