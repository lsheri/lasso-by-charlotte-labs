import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import type { TelemetryDims, TelemetryEvent } from "./telemetry-shared";

/** Publishable project key — safe in source, write-only ingest. */
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

/** Fire-and-forget mirror. Content-free: hashes and dimensions only. */
function mirrorToPostHog(
  eventType: TelemetryEvent,
  actorHash: string | null,
  tenantHash: string,
  dims: TelemetryDims,
): void {
  if (!actorHash) return;
  void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  }).catch(() => {
    /* analytics must never surface to the user */
  });
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
  },
): Promise<void> {
  try {
    const dims = input.dims ?? {};
    const tenantHash = await sha256Hex(input.orgId);
    const actorHash = await computeActorHash(input.userId);
    await supabase.from("events").insert({
      event_type: input.eventType,
      schema_version: "v1",
      tenant_hash: tenantHash,
      actor_hash: actorHash,
      dims,
      payload: {},
    });
    mirrorToPostHog(input.eventType, actorHash, tenantHash, dims);
  } catch {
    /* telemetry must never block or surface to the user */
  }
}
