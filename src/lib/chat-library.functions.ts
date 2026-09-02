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

/**
 * Pass 157b: one settled chat library search. Dims are bands and a boolean;
 * the words travel in the payload, which the existing per level egress mapping
 * releases at work details and above only. Never surfaced on failure.
 */
export const noteChatSearchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string; results: number; had_click?: boolean }) => ({
    query: typeof input?.query === "string" ? input.query.slice(0, 500) : "",
    results: Number.isFinite(input?.results) ? Math.max(0, Math.trunc(input.results)) : 0,
    had_click: input?.had_click === true,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { isSettledQuery, queryLenBand, resultBand } = await import("./chat-search-signal");
    if (!isSettledQuery(data.query)) return { ok: true };
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return { ok: true };

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "chatlib.search",
      orgId: profile.org_id,
      userId,
      profileId: profile.id,
      dims: {
        query_len_band: queryLenBand(data.query.trim().length),
        result_band: resultBand(data.results),
        had_click: data.had_click,
      },
      payload: { query: data.query.trim() },
    });
    return { ok: true };
  });
