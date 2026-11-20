import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PilotRow, PilotSetupInput, PilotSetupResult } from "@/lib/pilot-setup-shared";

/**
 * 20 Nov 2026, Set up a pilot. Both functions start with the founder gate on the server (403 for everyone else); the
 * page hiding itself is not the check. Writes go through the service role only after the gate passes.
 */
export const setUpPilotFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PilotSetupInput) => ({ firm_name: String(input?.firm_name ?? ""), admin_email: String(input?.admin_email ?? "") }))
  .handler(async ({ data, context }): Promise<PilotSetupResult> => {
    const { setUpPilot, realPilotDeps } = await import("./pilot-setup.server");
    return setUpPilot(await realPilotDeps(context.userId), data);
  });

export const listPilotsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PilotRow[]> => {
    const { listPilots } = await import("./pilot-setup.server");
    return listPilots(context.userId);
  });
