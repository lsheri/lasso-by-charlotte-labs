import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EgressRunView = { sent: number; skipped: number; failed: number };

/** Manual sweep, admins only. Reads nothing new and changes no event. */
export const runEgressNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined }) => input)
  .handler(async ({ data, context }): Promise<EgressRunView> => {
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile || profile.role !== "admin") throw new Error("Forbidden");
    const { runEgress } = await import("./egress.server");
    return runEgress();
  });
