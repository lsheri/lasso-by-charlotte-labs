import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { CAPTURE_VIAS, type CaptureVia } from "./work-taxonomy";

/**
 * Pass 148. Browser capture paths (upload, paste) call this after they write
 * their rows; the events themselves are computed and written server side, once
 * per newly created item. Failure is never surfaced.
 */
export const noteCaptureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_ids: string[]; via: CaptureVia }) => {
    const via = CAPTURE_VIAS.includes(input?.via) ? input.via : "manual";
    const ids = (input?.work_item_ids ?? []).filter((id) => typeof id === "string").slice(0, 50);
    return { work_item_ids: ids, via };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (data.work_item_ids.length === 0) return { ok: true };
    const { supabase, userId } = context;

    // RLS decides what this person may see; nothing else is read.
    const { data: items } = await supabase
      .from("work_items")
      .select("id, type, source, source_vendor, source_meta, meta, org_id, owner_id")
      .in("id", data.work_item_ids);
    if (!items || items.length === 0) return { ok: true };

    const { noteModelUsed, noteThreadShape } = await import("./work-taxonomy.server");
    const { noteCaptureContext } = await import("./capture-census.server");
    for (const item of items) {
      const actor = { orgId: item.org_id, userId, profileId: item.owner_id };
      const sourceMeta = (item.source_meta ?? {}) as { model?: unknown };
      if (item.type === "ai_thread") {
        const { data: turns } = await supabase
          .from("turns")
          .select("role, content, ts, model")
          .eq("work_item_id", item.id)
          .order("turn_no", { ascending: true });
        const rows = turns ?? [];
        const shaped = rows.map((t) => ({
          role: String(t.role),
          length: (t.content ?? "").length,
        }));
        await noteModelUsed(supabase, actor, {
          item: item as never,
          via: data.via,
          turnCount: shaped.length,
          modelRaws: [sourceMeta.model, ...rows.map((t) => (t as { model?: unknown }).model)],
        });
        await noteThreadShape(supabase, actor, shaped);
        // Pass 155: the machine context of this capture, once per new item.
        await noteCaptureContext(supabase, actor, {
          turns: rows.map((t) => ({
            role: String(t.role),
            content: t.content ?? "",
            ts: (t as { ts?: string | null }).ts ?? null,
          })),
          clientName: data.via,
          clientVersion: "unknown",
          protocolVersion: "unknown",
          bytes: rows.reduce((sum, t) => sum + (t.content ?? "").length, 0),
        });
      } else {
        await noteModelUsed(supabase, actor, {
          item: item as never,
          via: data.via,
          modelRaws: [sourceMeta.model],
        });
      }
    }
    return { ok: true };
  });
