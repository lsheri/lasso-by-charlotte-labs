import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { FirmDashboard } from "./firm-dashboard-shared";
import type { FirmCheckLibraryRow } from "./firm-dashboard.server";

type Ctx = { profile_id?: string | undefined };

export const getFirmDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Ctx) => input)
  .handler(async ({ data, context }): Promise<FirmDashboard> => {
    const { requireFirmView } = await import("./firm-view.server");
    const { buildFirmDashboard } = await import("./firm-dashboard.server");
    const { recordEvent } = await import("./telemetry.server");
    const { profile, supabaseAdmin } = await requireFirmView(
      context.supabase,
      context.userId,
      data.profile_id,
    );
    const dashboard = await buildFirmDashboard(supabaseAdmin, profile.org_id);
    await recordEvent(supabaseAdmin, {
      eventType: "admin.dashboard_viewed",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { panels_shown: dashboard.panels_shown },
    });
    return dashboard;
  });

export const getFirmCheckLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Ctx) => input)
  .handler(async ({ data, context }): Promise<FirmCheckLibraryRow[]> => {
    const { requireFirmView } = await import("./firm-view.server");
    const { listFirmCheckLibrary } = await import("./firm-dashboard.server");
    const { profile, supabaseAdmin } = await requireFirmView(
      context.supabase,
      context.userId,
      data.profile_id,
    );
    return listFirmCheckLibrary(supabaseAdmin, profile.org_id);
  });

/**
 * Deactivate or restore a check. The RPC runs as the signed-in user and owns
 * the admin rule, so no admin client is involved in the decision.
 */
export const setFirmCheckActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { check_id: string; active: boolean; profile_id?: string | undefined }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { requireFirmView } = await import("./firm-view.server");
    await requireFirmView(context.supabase, context.userId, data.profile_id);
    const { error } = await context.supabase.rpc("set_firm_check_active", {
      p_check: data.check_id,
      p_active: data.active,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
