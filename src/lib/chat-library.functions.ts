import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Chat library: someone opened the original conversation in the tool it came
 * from. Only the tool name travels, from the closed vendor vocabulary, and it
 * goes through the ordinary stamped recordEvent path. Failure is never
 * surfaced: a link is a link.
 */
export const noteSourceOpenedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string }) => ({
    work_item_id: typeof input?.work_item_id === "string" ? input.work_item_id : "",
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!data.work_item_id) return { ok: true };
    const { supabase, userId } = context;

    const { data: item } = await supabase
      .from("work_items")
      .select("id, org_id, owner_id, source, source_vendor, source_meta")
      .eq("id", data.work_item_id)
      .maybeSingle();
    if (!item) return { ok: true };

    const { vendorFromSource } = await import("./work-taxonomy");
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "chatlib.source_opened",
      orgId: item.org_id,
      userId,
      profileId: item.owner_id,
      dims: { vendor: vendorFromSource(item as never) },
    });
    return { ok: true };
  });
