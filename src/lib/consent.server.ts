import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { CONSENT_POLICY_VERSION } from "./consent-shared";
import { pseudonyms } from "./telemetry-v2.server";

/** The consent fact is the audit trail the analysis layer reads, pseudonymously. */
export async function writeFactConsent(
  supabase: SupabaseClient<Database>,
  orgId: string,
  profileId: string,
  purpose: string,
  granted: boolean,
): Promise<void> {
  try {
    const key = process.env["TELEMETRY_SALT"];
    if (!key) {
      console.error("[consent] fact write skipped: TELEMETRY_SALT is not set", {
        orgId,
        profileId,
        purpose,
        granted,
        policy_version: CONSENT_POLICY_VERSION,
      });
      return;
    }
    const ids = await pseudonyms(key, orgId, profileId, null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const core = (supabaseAdmin as unknown as { schema: (s: string) => any }).schema(
      "analytics_core",
    );
    const { error } = await core.from("fact_consent").insert({
      tenant_pseudo: ids.tenant,
      actor_pseudo: ids.actor,
      purpose,
      granted,
      policy_version: CONSENT_POLICY_VERSION,
    });
    if (error) {
      console.error("[consent] fact write failed", {
        orgId,
        profileId,
        purpose,
        granted,
        message: error.message,
      });
    }
  } catch (e) {
    console.error("[consent] fact write threw", {
      orgId,
      profileId,
      purpose,
      granted,
      message: (e as Error).message,
    });
  }
}

