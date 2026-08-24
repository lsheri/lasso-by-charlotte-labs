import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Rendition } from "@/lib/rendition.server";

/** Long enough to read a deck, short enough that a leaked link dies quickly. */
const SIGNED_URL_SECONDS = 900;

/**
 * A short lived signed url for an item whose stored bytes are a pdf, and only
 * for a caller who can already read the item. Anything else answers "none".
 */
export const getRenditionUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string }) => {
    if (!input?.work_item_id) throw new Error("work_item_id is required");
    return { work_item_id: input.work_item_id };
  })
  .handler(async ({ data, context }): Promise<Rendition> => {
    const { resolveRendition, RENDITION_BUCKET } = await import("./rendition.server");
    return resolveRendition(context.supabase, data.work_item_id, async (path) => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage
        .from(RENDITION_BUCKET)
        .createSignedUrl(path, SIGNED_URL_SECONDS);
      return signed?.signedUrl ?? null;
    });
  });
