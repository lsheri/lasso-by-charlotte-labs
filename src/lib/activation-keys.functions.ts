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
 * The client sends the code and nothing else. Identity comes from the verified
 * bearer token (requireSupabaseAuth); profile and org are read server side.
 * Never throws at the caller, never logs the code, never returns an id.
 */
export const redeemActivationKeyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({
    code: typeof input?.code === "string" ? input.code.slice(0, 200) : "",
  }))
  .handler(async ({ data, context }): Promise<RedeemOutcome & { institution_name?: string }> => {
    try {
      const userId = context.userId;
      if (!userId) return outcome("error");

      if (!allowAttempt(userId)) return outcome("rate_limited");

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Oldest active profile for this user, same rule resolveProfile uses
      // when no active profile id is supplied. Nothing from the request.
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, org_id")
        .eq("user_id", userId)
        .is("deactivated_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (profileError || !profile) return outcome("error");

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
