import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  CONSENT_TEXT_VERSION,
  DEFAULT_ORG_TIER,
  DEFAULT_TIER_D_SWITCH,
  DEFAULT_USER_TIER,
  isDataTier,
  noticeHash,
  type ConsentScope,
  type DataTier,
} from "./data-consent-shared";

export type ConsentChange = {
  version: number;
  created_at: string;
  scope: string;
  old_tier: string | null;
  new_tier: string;
  actor_name: string | null;
};

export type DataConsentView = {
  role: string;
  is_admin: boolean;
  org_tier: DataTier;
  org_tier_d_switch: boolean;
  user_tier: DataTier;
  /** Wording version of the latest ledger entry for each scope, when there is one. */
  org_text_version: string | null;
  user_text_version: string | null;
  changes: ConsentChange[];
};

/** Both state rows plus, for admins, the list of changes. Read only. */
export const getDataConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined }) => input)
  .handler(async ({ data, context }): Promise<DataConsentView | null> => {
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) return null;

    const { data: rows } = await context.supabase
      .from("data_consent_state")
      .select("scope, tier, tier_d_switch, profile_id")
      .eq("org_id", profile.org_id);

    const orgRow = (rows ?? []).find((row) => row.scope === "org");
    const userRow = (rows ?? []).find(
      (row) => row.scope === "user" && row.profile_id === profile.id,
    );

    const { data: latest } = await context.supabase
      .from("data_consent_ledger")
      .select("scope, profile_id, consent_text_version, created_at")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(200);
    const orgTextVersion =
      (latest ?? []).find((row) => row.scope === "org")?.consent_text_version ?? null;
    const userTextVersion =
      (latest ?? []).find((row) => row.scope === "user" && row.profile_id === profile.id)
        ?.consent_text_version ?? null;

    const isAdmin = profile.role === "admin";
    let changes: ConsentChange[] = [];
    if (isAdmin) {
      const { data: ledger } = await context.supabase
        .from("data_consent_ledger")
        .select("version, created_at, scope, old_tier, new_tier, actor_profile_id")
        .eq("org_id", profile.org_id)
        .eq("scope", "org")
        .order("created_at", { ascending: false })
        .limit(25);
      const actorIds = Array.from(
        new Set((ledger ?? []).map((row) => row.actor_profile_id).filter(Boolean)),
      ) as string[];
      const names = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: people } = await context.supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", actorIds);
        for (const person of people ?? []) names.set(person.id, person.display_name);
      }
      changes = (ledger ?? []).map((row) => ({
        version: row.version,
        created_at: row.created_at,
        scope: row.scope,
        old_tier: row.old_tier,
        new_tier: row.new_tier,
        actor_name: row.actor_profile_id ? (names.get(row.actor_profile_id) ?? null) : null,
      }));
    }

    return {
      role: profile.role,
      is_admin: isAdmin,
      org_tier: isDataTier(orgRow?.tier) ? orgRow.tier : DEFAULT_ORG_TIER,
      org_tier_d_switch: orgRow?.tier_d_switch ?? DEFAULT_TIER_D_SWITCH,
      user_tier: isDataTier(userRow?.tier) ? userRow.tier : DEFAULT_USER_TIER,
      org_text_version: orgTextVersion,
      user_text_version: userTextVersion,
      changes,
    };
  });

/**
 * Every change goes through the database function, which decides whether the
 * caller may make it. The browser never writes the tables.
 */
export const setDataConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      scope: ConsentScope;
      tier: DataTier;
      tier_d_switch?: boolean | undefined;
      surface: string;
      profile_id?: string | undefined;
    }) => {
      if (input.scope !== "org" && input.scope !== "user") throw new Error("Unknown scope.");
      if (!isDataTier(input.tier)) throw new Error("Unknown level.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const hash = await noticeHash(data.scope, data.tier);
    const { data: version, error } = await context.supabase.rpc("set_data_consent", {
      p_scope: data.scope,
      p_tier: data.tier,
      p_tier_d_switch: data.tier === "d" ? (data.tier_d_switch ?? false) : false,
      p_consent_text_version: CONSENT_TEXT_VERSION,
      p_notice_hash: hash,
      p_surface: data.surface,
    });
    if (error) throw new Error(error.message);
    return { ok: true, version: version ?? 0 };
  });

/**
 * The person's separate research choice. This writes no table: it leaves one
 * stamped event as the interim trail while the durable record is built.
 */
export const recordResearchChoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { choice: "joined" | "left"; profile_id?: string | undefined }) => {
    if (input.choice !== "joined" && input.choice !== "left") throw new Error("Unknown choice.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) throw new Error("We could not find your profile.");

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "consent.research_change",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { choice: data.choice },
      profileId: profile.id,
      sessionId: null,
      clientSeq: null,
    });
    return { ok: true };
  });
