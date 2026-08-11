import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Signed URL for a stored work file. MCP-pushed files are written with the
 * service role, so they carry no storage `owner` and the browser client cannot
 * read them directly — the signature is minted server-side after the caller's
 * access to the work item is confirmed through RLS.
 */
export const getWorkFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string }) => input)
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { data: item, error } = await context.supabase
      .from("work_items")
      .select("id, title, content_ref, source_meta")
      .eq("id", data.work_item_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item?.content_ref) throw new Error("This item has no stored file.");

    const meta = (item.source_meta ?? {}) as { filename?: string };
    const filename = meta.filename ?? item.title;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signed = await supabaseAdmin.storage
      .from("work-files")
      .createSignedUrl(item.content_ref, 300, { download: filename });
    if (signed.error || !signed.data) {
      throw new Error(signed.error?.message ?? "Could not open this file.");
    }
    return { url: signed.data.signedUrl };
  });
