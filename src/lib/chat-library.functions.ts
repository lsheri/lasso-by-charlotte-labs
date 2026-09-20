import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";

/**
 * Chat library: someone opened the original conversation in the tool it came
 * from. Only the tool name travels, from the closed vendor vocabulary, and it
 * goes through the ordinary stamped recordEvent path. Failure is never
 * surfaced: a link is a link.
 */
export const noteSourceOpenedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string; profile_id?: string | undefined }) => ({
    work_item_id: typeof input?.work_item_id === "string" ? input.work_item_id : "",
    profile_id: input?.profile_id ?? null,
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
  .inputValidator((input: { query: string; results: number; had_click?: boolean; profile_id?: string | undefined }) => ({
    query: typeof input?.query === "string" ? input.query.slice(0, 500) : "",
    results: Number.isFinite(input?.results) ? Math.max(0, Math.trunc(input.results)) : 0,
    had_click: input?.had_click === true,
    profile_id: input?.profile_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { isSettledQuery, queryLenBand, resultBand } = await import("./chat-search-signal");
    if (!isSettledQuery(data.query)) return { ok: true };
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
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


/**
 * Pass 175: how the chat library is shown, cards or list. Closed vocabulary in
 * dims, nothing else travels. Never surfaced on failure.
 *
 * Pass A2 adds three more values to the same closed vocabulary, for which
 * conversations are shown: captured, asked, everything. Additive only; the
 * existing two values are unchanged.
 */
const CHAT_VIEWS = ["cards", "list", "preview", "sticky", "captured", "asked", "everything"] as const;

export const noteChatViewChangedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { view: string; profile_id?: string | undefined }) => ({
    view: (CHAT_VIEWS as readonly string[]).includes(input?.view) ? input.view : "",
    profile_id: input?.profile_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!data.view) return { ok: true };
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { ok: true };

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "chatlib.view_changed",
      orgId: profile.org_id,
      userId,
      profileId: profile.id,
      dims: { view: data.view },
    });
    return { ok: true };
  });

/**
 * Pass 176: the reading pane was closed, and how. Closed vocabulary in dims,
 * nothing else travels. Never surfaced on failure.
 */
export const noteReaderClosedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { view: string; how: string; profile_id?: string | undefined }) => ({
    view: input?.view === "cards" || input?.view === "list" ? input.view : "",
    how:
      input?.how === "button" || input?.how === "escape" || input?.how === "reselect"
        ? input.how
        : "",
    profile_id: input?.profile_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!data.view || !data.how) return { ok: true };
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { ok: true };

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "chatlib.reader_closed",
      orgId: profile.org_id,
      userId,
      profileId: profile.id,
      dims: { view: data.view, how: data.how },
    });
    return { ok: true };
  });

/**
 * Pass 179: a chat library filter was changed. Which filter, and whether it
 * narrowed to one or opened to everything. No ids, no names, no free text.
 * Never surfaced on failure.
 */
export const noteFilterChangedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filter: string; selected: string; profile_id?: string | undefined }) => ({
    filter: input?.filter === "tool" || input?.filter === "engagement" ? input.filter : "",
    selected: input?.selected === "all" || input?.selected === "one" ? input.selected : "",
    profile_id: input?.profile_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!data.filter || !data.selected) return { ok: true };
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { ok: true };

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "chatlib.filter_changed",
      orgId: profile.org_id,
      userId,
      profileId: profile.id,
      dims: { filter: data.filter, selected: data.selected },
    });
    return { ok: true };
  });
