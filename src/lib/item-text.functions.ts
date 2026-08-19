import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    const result = await getItemText(context.supabase, item);
    return {
      text: result.text ? result.text.slice(0, 200_000) : null,
      status: result.status,
      note: result.note ?? null,
    };
  });
