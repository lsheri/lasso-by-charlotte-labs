import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TextItem } from "./item-text.server";

export type ItemTextPane = {
  text: string | null;
  status: "ok" | "unreadable" | "unsupported" | "failed";
  note: string | null;
};

/**
 * The reading pane for formats a browser cannot render (docx, pptx, xlsx, odt).
 * It returns the SAME text the analysis layer reads, through the same reader,
 * so what a person sees here is exactly what a model would have seen.
 */
export const getItemTextPane = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string }) => {
    if (!input?.work_item_id) throw new Error("work_item_id is required");
    return { work_item_id: input.work_item_id };
  })
  .handler(async ({ data, context }): Promise<ItemTextPane> => {
    const { ITEM_TEXT_COLUMNS, getItemText } = await import("./item-text.server");
    const { data: item, error } = await context.supabase
      .from("work_items")
      .select(ITEM_TEXT_COLUMNS)
      .eq("id", data.work_item_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("That item is not available to you.");

    const result = await getItemText(context.supabase, item as unknown as TextItem);
    return {
      text: result.text ? result.text.slice(0, 200_000) : null,
      status: result.status,
      note: result.note ?? null,
    };
  });

/**
 * "Try reading it again": owner-only, re-runs the one extraction path on a file
 * whose contents could not be read. The cached verdict is cleared first, or the
 * reader would hand back the same failure without opening the file. Status is
 * written by the reader's own single writer; the attempt is logged to health.
 */
export const reextractItemText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string }) => {
    if (!input?.work_item_id) throw new Error("work_item_id is required");
    return { work_item_id: input.work_item_id };
  })
  .handler(async ({ data, context }): Promise<{ status: string; note: string | null }> => {
    const { ITEM_TEXT_COLUMNS, getItemText } = await import("./item-text.server");
    const { data: item, error } = await context.supabase
      .from("work_items")
      .select(`${ITEM_TEXT_COLUMNS}, owner_id`)
      .eq("id", data.work_item_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("That item is not available to you.");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile || profile.id !== (item as { owner_id: string }).owner_id) {
      throw new Response("Forbidden", { status: 403 });
    }

    const meta = ((item as { meta?: Record<string, unknown> | null }).meta ?? {}) as Record<
      string,
      unknown
    >;
    const cleared = { ...meta };
    delete cleared["text_status"];
    delete cleared["text_source_hash"];
    delete cleared["text_ref"];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("work_items")
      .update({ meta: cleared as never })
      .eq("id", data.work_item_id);

    const result = await getItemText(context.supabase, {
      ...(item as unknown as TextItem),
      meta: cleared as never,
    });

    const { logHealth } = await import("@/lib/health.server");
    await logHealth({
      kind: result.status === "ok" ? "anomaly" : "error",
      surface: "item_text",
      detail: `reextract_${result.status}`,
      meta: {
        work_item_id: data.work_item_id,
        text_status: result.status,
        reason: "manual_reextract",
      },
    });

    if (result.status === "ok") {
      const { ensureExtract } = await import("./extract.server");
      await ensureExtract(data.work_item_id);
    }
    return { status: result.status, note: result.note ?? null };
  });
