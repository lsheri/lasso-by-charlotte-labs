import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { CONSENT_POLICY_VERSION, PURPOSE_RANK } from "./consent-shared";
import { CONSENT_PURPOSES, type ConsentPurpose } from "./telemetry-v2-shared";

export type DataUseState = {
  is_admin: boolean;
  policy_version: string;
  grants: Record<string, boolean>;
  tier: string;
};

function emailOf(claims: unknown): string | null {
  return (claims as { email?: string } | null | undefined)?.email ?? null;
}

/** The latest ledger row per purpose is the current answer. */
export const getDataUse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined }) => input)
  .handler(async ({ data, context }): Promise<DataUseState | null> => {
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) return null;

    // The registry is a declaration of what Lasso derives. Seeding it here keeps
    // it current wherever the data use surface is opened, and it is idempotent.
    void (async () => {
      const { seedFeatureRegistry } = await import("./facts.server");
      await seedFeatureRegistry();
    })().catch(() => {});

    const { data: rows } = await context.supabase
      .from("consent_ledger")
      .select("purpose, granted, created_at")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: true });

    const grants: Record<string, boolean> = { operate: true };
    for (const row of rows ?? []) grants[row.purpose] = row.granted;

    const { data: org } = await context.supabase
      .from("orgs")
      .select("data_use_tier")
      .eq("id", profile.org_id)
      .maybeSingle();

    return {
      is_admin: profile.role === "admin",
      policy_version: CONSENT_POLICY_VERSION,
      grants,
      tier: org?.data_use_tier ?? "operate",
    };
  });

/**
 * The admin answers for the organisation. The org is resolved on the server;
 * the browser never says which workspace it is answering for.
 */
export const setDataUse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { purpose: ConsentPurpose; granted: boolean; profile_id?: string | undefined }) => {
      if (!CONSENT_PURPOSES.includes(input.purpose)) throw new Error("Unknown purpose.");
      if (input.purpose === "operate") throw new Error("Operating the product cannot be changed.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: isAdmin } = await supabase.rpc("has_org_role", {
      p_org: profile.org_id,
      p_roles: ["admin"],
    });
    if (isAdmin !== true) throw new Response("Forbidden", { status: 403 });

    // Was this purpose previously granted? Turning off a granted purpose is a
    // withdrawal, which is a different fact from never having agreed.
    const { data: prior } = await supabase
      .from("consent_ledger")
      .select("granted")
      .eq("org_id", profile.org_id)
      .eq("purpose", data.purpose)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const wasGranted = prior?.granted === true;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("consent_ledger").insert({
      org_id: profile.org_id,
      profile_id: null,
      purpose: data.purpose,
      granted: data.granted,
      policy_version: CONSENT_POLICY_VERSION,
    });
    if (error) {
      // Every purpose takes the same path, so a purpose specific rejection can
      // only come from the database. Say which one failed and why.
      console.error("[consent] ledger write failed", {
        orgId: profile.org_id,
        purpose: data.purpose,
        granted: data.granted,
        message: error.message,
      });
      throw new Error(`That could not be saved (${data.purpose}): ${error.message}`);
    }


    // The tier on the org is the highest purpose currently granted.
    const { data: rows } = await supabase
      .from("consent_ledger")
      .select("purpose, granted, created_at")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: true });
    const current: Record<string, boolean> = {};
    for (const row of rows ?? []) current[row.purpose] = row.granted;
    current[data.purpose] = data.granted;
    let tier: ConsentPurpose = "operate";
    for (const purpose of CONSENT_PURPOSES) {
      if (current[purpose] && PURPOSE_RANK[purpose] > PURPOSE_RANK[tier]) tier = purpose;
    }
    await supabaseAdmin.from("orgs").update({ data_use_tier: tier }).eq("id", profile.org_id);

    const { recordEventV2 } = await import("./telemetry-v2.server");
    const eventName = data.granted
      ? ("consent.granted" as const)
      : wasGranted
        ? ("consent.withdrawn" as const)
        : ("consent.declined" as const);
    await recordEventV2(supabase, userId, {
      eventName,
      props: { purpose: data.purpose, policy_version: CONSENT_POLICY_VERSION },
      profileId: profile.id,
      email: emailOf(context.claims),
    });

    const { writeFactConsent } = await import("./consent.server");
    await writeFactConsent(supabase, profile.org_id, profile.id, data.purpose, data.granted);

    return { ok: true, tier };
  });

/** Fired once when the four purposes are shown to an admin. */
export const noteConsentPresented = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined }) => input)
  .handler(async ({ data, context }) => {
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) return { ok: false };
    const { recordEventV2 } = await import("./telemetry-v2.server");
    await recordEventV2(context.supabase, context.userId, {
      eventName: "consent.presented",
      props: { purpose_count: CONSENT_PURPOSES.length, policy_version: CONSENT_POLICY_VERSION },
      profileId: profile.id,
      email: emailOf(context.claims),
    });
    return { ok: true };
  });
