import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

import { bucket } from "./telemetry-shared";
import {
  EPISODE_ITEM_ROLES,
  EPISODE_STATUSES,
  OUTCOME_KINDS,
  OUTCOME_SOURCES,
  QUESTION_INTENT_CLASSES,
  QUESTION_STAGES,
  QUESTION_TARGETS,
  type EventNameV2,
  type EventSourceV2,
} from "./telemetry-v2-shared";

/**
 * TELEMETRY V2 GATEWAY.
 *
 * Privacy is governing who may see which representation, not destroying data at
 * collection. The canonical row in events_v2 therefore carries exact integers,
 * while the outbound PostHog mirror receives a separate, bucketed props object.
 * One inbound record, two representations.
 *
 * Identity is resolved on the server from the authenticated user. An org id
 * arriving from a browser is never event truth.
 */

const TAXONOMY_VERSION = "v2.0";
const KEY_VERSION = "v1";

/** The registry. An event name that is not here cannot be recorded. */
const SCHEMAS = {
  "episode.created": z
    .object({
      has_task: z.boolean(),
      item_count: z.number().int().nonnegative(),
    })
    .strict(),
  "episode.item_linked": z
    .object({
      item_role: z.enum(EPISODE_ITEM_ROLES),
      item_count: z.number().int().nonnegative(),
    })
    .strict(),
  "episode.closed": z
    .object({
      status: z.enum(EPISODE_STATUSES),
      item_count: z.number().int().nonnegative(),
      days_open: z.number().int().nonnegative(),
    })
    .strict(),
  "outcome.declared": z
    .object({
      kind: z.enum(OUTCOME_KINDS),
      outcome_source: z.enum(OUTCOME_SOURCES),
      item_count: z.number().int().nonnegative(),
    })
    .strict(),
  "question.asked": z
    .object({
      intent_class: z.enum(QUESTION_INTENT_CLASSES),
      target: z.enum(QUESTION_TARGETS),
      stage: z.enum(QUESTION_STAGES),
      question_chars: z.number().int().nonnegative(),
    })
    .strict(),
  "finding.labelled": z
    .object({
      preset: z.string().max(64),
      label: z.enum(["confirmed", "rejected"]),
      claims_rendered: z.number().int().nonnegative(),
    })
    .strict(),
} satisfies Record<EventNameV2, z.ZodTypeAny>;

export type PropsV2 = Record<string, string | number | boolean>;

const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const URL_LIKE = /(https?:\/\/|www\.|\/\/)/i;

/**
 * The leak guard. Free text has no business in v2 props: the exact text of a
 * question, a title, a filename or a URL stays in the tenant's own tables.
 */
function leakReason(value: string): string | null {
  if (value.length > 80) return "too_long";
  if (EMAIL_LIKE.test(value)) return "email_like";
  if (URL_LIKE.test(value)) return "url_like";
  if (value.trim().split(/\s+/).length > 5) return "free_text";
  return null;
}

function guardProps(eventName: EventNameV2, props: PropsV2): boolean {
  for (const [key, value] of Object.entries(props)) {
    if (typeof value !== "string") continue;
    const reason = leakReason(value);
    if (reason) {
      // The event name and the reason only. Never the value.
      console.warn(`[telemetry-v2] rejected ${eventName}: prop ${key} ${reason}`);
      return false;
    }
  }
  return true;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Tenant-scoped by construction: the same person at two employers produces two
 * unlinkable actor pseudonyms. Keyed HMAC, never a plain hash, and never the
 * v1 global actor hash.
 */
async function pseudonyms(
  key: string,
  orgId: string,
  profileId: string | null,
  subjectProfileId: string | null,
): Promise<{ tenant: string; actor: string | null; subject: string | null }> {
  const tenant = await hmacHex(key, orgId);
  const actor = profileId ? await hmacHex(key, `${orgId}:${profileId}`) : null;
  const subject = subjectProfileId ? await hmacHex(key, `${orgId}:${subjectProfileId}`) : null;
  return { tenant, actor, subject };
}

/** QA traffic must never pollute the panel. */
function resolveEnvironment(email: string | null, orgName: string | null): string {
  const configured = process.env["LASSO_ENVIRONMENT"];
  const domain = (email ?? "").split("@")[1]?.toLowerCase() ?? "";
  if (domain === "qaprobe.test") return "qa";
  if ((orgName ?? "").startsWith("QA Probe")) return "qa";
  if (configured === "staging" || configured === "test" || configured === "qa") return configured;
  return "production";
}

/** Outbound representation: every exact number is bucketed on the way out. */
function bucketedMirror(props: PropsV2): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    out[key] = typeof value === "number" ? bucket(value) : value;
  }
  return out;
}

export type RecordEventV2Input = {
  eventName: EventNameV2;
  props: PropsV2;
  /** The active profile the browser claims; verified against the caller's user. */
  profileId?: string | null | undefined;
  subjectProfileId?: string | null | undefined;
  episodeId?: string | null | undefined;
  workItemId?: string | null | undefined;
  engagementId?: string | null | undefined;
  source?: EventSourceV2 | undefined;
  actorType?: "user" | "system" | undefined;
  /** From the verified JWT claims, used only to spot QA identities. */
  email?: string | null | undefined;
};

/**
 * The single write path for v2. Never throws: telemetry must not be able to
 * fail a product action.
 */
export async function recordEventV2(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: RecordEventV2Input,
): Promise<void> {
  try {
    const schema = SCHEMAS[input.eventName] as z.ZodTypeAny | undefined;
    if (!schema) {
      console.warn(`[telemetry-v2] rejected unknown event name: ${String(input.eventName)}`);
      return;
    }
    const parsed = schema.safeParse(input.props);
    if (!parsed.success) {
      console.warn(`[telemetry-v2] rejected ${input.eventName}: props failed validation`);
      return;
    }
    const props = parsed.data as PropsV2;
    if (!guardProps(input.eventName, props)) return;

    // Identity is resolved here, from the authenticated user, through RLS.
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(supabase, userId, input.profileId ?? null);
    if (!profile) {
      console.warn(`[telemetry-v2] skipped ${input.eventName}: no profile for caller`);
      return;
    }

    const key = process.env["TELEMETRY_SALT"];
    if (!key) {
      console.warn(`[telemetry-v2] skipped ${input.eventName}: no key configured`);
      return;
    }
    const ids = await pseudonyms(
      key,
      profile.org_id,
      profile.id,
      input.subjectProfileId ?? null,
    );

    const { data: org } = await supabase
      .from("orgs")
      .select("name")
      .eq("id", profile.org_id)
      .maybeSingle();
    const environment = resolveEnvironment(input.email ?? null, org?.name ?? null);

    const canonicalProps = { ...props, _key_version: KEY_VERSION };

    // events_v2 has RLS on and zero policies, by design: service role only.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("events_v2").insert({
      event_name: input.eventName,
      schema_version: TAXONOMY_VERSION,
      occurred_at: new Date().toISOString(),
      environment,
      source: input.source ?? "web",
      tenant_pseudo: ids.tenant,
      actor_pseudo: ids.actor,
      subject_pseudo: ids.subject,
      actor_type: input.actorType ?? "user",
      episode_id: input.episodeId ?? null,
      work_item_id: input.workItemId ?? null,
      engagement_id: input.engagementId ?? null,
      taxonomy_version: TAXONOMY_VERSION,
      consent_snapshot: null,
      props: canonicalProps as never,
    });
    if (error) console.error(`[telemetry-v2] insert failed for ${input.eventName}:`, error.message);

    // The mirror leaves bucketed. QA traffic is never mirrored.
    if (environment === "production") {
      const { mirrorToPostHog } = await import("./telemetry.server");
      await mirrorToPostHog(
        input.eventName as never,
        ids.actor,
        ids.tenant,
        bucketedMirror(props) as never,
      );
    }
  } catch (e) {
    console.error("[telemetry-v2] recordEventV2 failed:", (e as Error).message);
  }
}
