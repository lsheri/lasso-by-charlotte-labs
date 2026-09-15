import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function canvasBand(value: number): "0" | "1-4" | "5-19" | "20+" {
  if (value <= 0) return "0";
  if (value <= 4) return "1-4";
  if (value <= 19) return "5-19";
  return "20+";
}

/** Records one canvas opening with banded counts only. Failures stay silent. */
export const noteCanvasOpenedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nodes: number; links: number; shelf: number }) => ({
    nodes: Number.isFinite(input?.nodes) ? Math.max(0, Math.trunc(input.nodes)) : 0,
    links: Number.isFinite(input?.links) ? Math.max(0, Math.trunc(input.links)) : 0,
    shelf: Number.isFinite(input?.shelf) ? Math.max(0, Math.trunc(input.shelf)) : 0,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    try {
      const { supabase, userId } = context;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, org_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!profile) return { ok: true };

      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabase, {
        eventType: "canvas.opened",
        orgId: profile.org_id,
        userId,
        profileId: profile.id,
        dims: {
          node_band: canvasBand(data.nodes),
          link_band: canvasBand(data.links),
          shelf_band: canvasBand(data.shelf),
        },
      });
    } catch {
      // Opening the canvas must never depend on recording this signal.
    }
    return { ok: true };
  });