import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const clamp = (value: number) => Math.max(0, Math.trunc(value));

/**
 * Pass 187: where one piece of work sits on the canvas. Position only. This
 * never writes membership and never changes what anyone can see.
 */
export const placeCanvasNodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      engagement_id: string;
      work_item_id: string;
      x: number | null;
      y: number | null;
      from?: string;
      method?: string;
    }) => ({
      engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
      work_item_id: typeof input?.work_item_id === "string" ? input.work_item_id : "",
      x: Number.isFinite(input?.x) ? clamp(input.x as number) : null,
      y: Number.isFinite(input?.y) ? clamp(input.y as number) : null,
      from: input?.from === "shelf" || input?.from === "canvas" ? input.from : "canvas",
      method: input?.method === "keyboard" ? "keyboard" : "pointer",
    }),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!data.engagement_id || !data.work_item_id) return { ok: true };
    // The request scoped client, never supabaseAdmin: row level security is what
    // enforces that only the owner of the work item may write this position.
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return { ok: true };

    const placing = data.x !== null && data.y !== null;

    if (placing) {
      const { error } = await supabase.from("canvas_nodes").upsert(
        {
          engagement_id: data.engagement_id,
          work_item_id: data.work_item_id,
          x: data.x as number,
          y: data.y as number,
          org_id: profile.org_id,
          owner_id: profile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "engagement_id,work_item_id" },
      );
      if (error) throw new Error("That did not save.");
    } else {
      const { error } = await supabase
        .from("canvas_nodes")
        .delete()
        .eq("engagement_id", data.engagement_id)
        .eq("work_item_id", data.work_item_id);
      if (error) throw new Error("That did not save.");
    }

    try {
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabase, {
        eventType: "canvas.node_moved",
        orgId: profile.org_id,
        userId,
        profileId: profile.id,
        dims: { from: data.from, to: placing ? "canvas" : "shelf", method: data.method },
      });
    } catch {
      // Moving work must never depend on recording this signal.
    }
    return { ok: true };
  });
