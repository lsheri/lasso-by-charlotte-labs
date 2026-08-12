import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Browser-side capture paths (paste, upload, history import) call this after
 * they write their rows. Access is confirmed through RLS first; the sidecar
 * itself writes with the service role. Failure is never surfaced.
 */
export const ensureExtractsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_ids: string[] }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const ids = (data.work_item_ids ?? []).filter((id) => typeof id === "string").slice(0, 50);
    if (ids.length === 0) return { ok: true };

    const { data: allowed } = await context.supabase.from("work_items").select("id").in("id", ids);
    const { ensureExtracts } = await import("./extract.server");
    await ensureExtracts((allowed ?? []).map((row) => row.id));
    return { ok: true };
  });
