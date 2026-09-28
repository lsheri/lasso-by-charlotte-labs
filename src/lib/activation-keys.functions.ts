import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createRateLimiter,
  isRedeemReason,
  messageForReason,
  type RedeemOutcome,
  type RedeemReason,
} from "@/lib/activation-keys";
import { institutionToRecord } from "@/lib/affiliation.functions";

// Best-effort only: five attempts per sixty seconds per user, held in this
// module's memory. Per instance, resets on redeploy, not shared across
// workers. A durable limiter needs a table. The real defence is high-entropy codes.
const allowAttempt = createRateLimiter(5, 60_000);

function outcome(reason: RedeemReason): RedeemOutcome & { institution_name?: string } {
  return { ok: reason === "redeemed" || reason === "already_redeemed", reason, message: messageForReason(reason) };
}

export type ProfileChoice =
  | { action: "use"; profile: { id: string; org_id: string } }
  | { action: "refuse" };

/**
 * Pure decision for which workspace the redemption targets.
 *
 * A workspace named by the client is used only when it comes back from a
 * query that required it to belong to the caller; otherwise the call
 * refuses. There is no fallback when a workspace is named: a silent
 * fallback is the bug this unit exists to remove, because it would
 * affiliate a workspace the person was not looking at.
 */
export function chooseProfile(
  suppliedProfileId: string | undefined,
  owned: { id: string; org_id: string } | null,
  queryFailed: boolean
): ProfileChoice {
  if (queryFailed) return { action: "refuse" };
  if (suppliedProfileId) {
    if (owned && owned.id === suppliedProfileId) return { action: "use", profile: owned };
    return { action: "refuse" };
  }
  if (owned) return { action: "use", profile: owned };
  return { action: "refuse" };
}

/**
 * The client sends the code and, optionally, the id of the workspace it is
 * looking at. Identity comes from the verified bearer token
 * (requireSupabaseAuth): `userId` is read from the verified claims and is
 * NEVER taken from the request body. The workspace is named by the client
 * and verified on the server. Never throws at the caller, never logs the
 * code, never returns an id.
 */
export const redeemActivationKeyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; profile_id?: string }) => ({
    code: typeof input?.code === "string" ? input.code.slice(0, 200) : "",
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<RedeemOutcome & { institution_name?: string }> => {
    try {
      const userId = context.userId;
      if (!userId) return outcome("error");

      // Keyed on the user, never on the workspace: a per-profile key would
      // hand one person five fresh tries for every workspace they are in.
      if (!allowAttempt(userId)) return outcome("rate_limited");

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Deliberately not resolveProfile: it falls back to the oldest active
      // profile when a requested id is not the caller's, which is exactly
      // the silent fallback this unit removes. A named workspace that does
      // not belong to the caller must refuse, never fall back.
      let profileRows: { id: string; org_id: string }[] = [];
      let queryFailed = false;
      if (data.profile_id) {
        // The named workspace must belong to the caller: user_id = userId is
        // the security boundary, and userId comes from the verified token,
        // never from the request body. If it does not come back, refuse and
        // do NOT fall back to any other profile: a silent fallback is the
        // bug this unit exists to remove, because it would affiliate a
        // workspace the person was not looking at.
        const named = await supabaseAdmin
          .from("profiles")
          .select("id, org_id")
          .eq("id", data.profile_id)
          .eq("user_id", userId)
          .is("deactivated_at", null)
          .limit(1);
        if (named.error) queryFailed = true;
        profileRows = (named.data as { id: string; org_id: string }[] | null) ?? [];
      } else {
        // No workspace named: oldest active profile for this user, same
        // fallback rule as before. Nothing else from the request.
        const oldest = await supabaseAdmin
          .from("profiles")
          .select("id, org_id")
          .eq("user_id", userId)
          .is("deactivated_at", null)
          .order("created_at", { ascending: true })
          .limit(1);
        if (oldest.error) queryFailed = true;
        profileRows = (oldest.data as { id: string; org_id: string }[] | null) ?? [];
      }

      const choice = chooseProfile(data.profile_id, profileRows[0] ?? null, queryFailed);
      if (choice.action === "refuse") return outcome("error");
      const profile = choice.profile;

      const { data: result, error } = await supabaseAdmin.rpc("redeem_activation_key", {
        p_code: data.code,
        p_profile_id: profile.id,
        p_user_id: userId,
        p_org_id: profile.org_id,
      });
      if (error || !result || typeof result !== "object" || Array.isArray(result)) {
        return outcome("error");
      }

      const row = result as { ok?: unknown; reason?: unknown; institution_id?: unknown };
      const reason: RedeemReason = isRedeemReason(row.reason) ? row.reason : "error";
      const base = { ok: row.ok === true, reason, message: messageForReason(reason) };

      if (base.ok && typeof row.institution_id === "string") {
        const { data: inst } = await supabaseAdmin
          .from("institutions")
          .select("name, slug")
          .eq("id", row.institution_id)
          .maybeSingle();

        // workspace.affiliated is recorded ONLY here, ONLY when the database
        // reports "redeemed": that is the one reason on which
        // redeem_activation_key wrote an org_affiliations row. "already_redeemed"
        // burns no seat and creates no row, so it never records. The dim is
        // the institution slug through the same closed-set mapping the old
        // endpoint used, matching the allowlist entry ["institution"].
        // Wrapped so a telemetry failure can never change what the person
        // sees: a redeemed key stays redeemed even if the event fails.
        if (reason === "redeemed") {
          try {
            const institution = institutionToRecord(inst?.slug) ?? "unknown";
            const { recordEvent } = await import("./telemetry.server");
            await recordEvent(context.supabase, {
              eventType: "workspace.affiliated",
              orgId: profile.org_id,
              userId,
              profileId: profile.id,
              dims: { institution },
            });
          } catch {
            // Deliberately swallowed; see above.
          }
        }

        if (inst?.name) return { ...base, institution_name: inst.name };
      }
      return base;
    } catch {
      return outcome("error");
    }
  });
