import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createRateLimiter,
  isRedeemReason,
  messageForReason,
  type RedeemOutcome,
  type RedeemReason,
} from "@/lib/activation-keys";

// Best-effort only: five attempts per sixty seconds per user, held in this
// module's memory. Per instance, resets on redeploy, not shared across
// workers. A durable limiter needs a table. The real defence is high-entropy codes.
const allowAttempt = createRateLimiter(5, 60_000);

function outcome(reason: RedeemReason): RedeemOutcome & { institution_name?: string } {
  return { ok: reason === "redeemed" || reason === "already_redeemed", reason, message: messageForReason(reason) };
}

/**
 * The client sends the code and, optionally, the id of the workspace it is
 * looking at. Identity comes from the verified bearer token
 * (requireSupabaseAuth): `userId` is read from the verified claims and is
 * NEVER taken from the request body. The workspace is named by the client
 * and verified on the server — a claim that is checked is not a claim that
 * is trusted. Never throws at the caller, never logs the code, never
 * returns an id.
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

      let profileRows: { id: string; org_id: string }[];
      if (data.profile_id) {
        // Verify the named workspace belongs to the caller. If it does not
        // come back, refuse and do NOT fall back to any other profile: a
        // silent fallback is the bug this unit exists to remove, because it
        // would affiliate a workspace the person was not looking at.
        const named = await supabaseAdmin
          .from("profiles")
          .select("id, org_id")
          .eq("id", data.profile_id)
          .eq("user_id", userId)
          .is("deactivated_at", null)
          .limit(1);
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
        profileRows = (oldest.data as { id: string; org_id: string }[] | null) ?? [];
      }

      const choice = chooseProfile(data.profile_id, profileRows[0] ?? null, profileErrorUnreadable(namedOrOldestError));
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
          .select("name")
          .eq("id", row.institution_id)
          .maybeSingle();
        if (inst?.name) return { ...base, institution_name: inst.name };
      }
      return base;
    } catch {
      return outcome("error");
    }
  });
