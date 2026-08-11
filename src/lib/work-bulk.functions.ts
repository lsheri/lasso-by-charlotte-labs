import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RemoveInput = { profile_id?: string | undefined; ids: string[] };

function validateRemove(input: RemoveInput): RemoveInput {
  if (!input || !Array.isArray(input.ids) || input.ids.length === 0) {
    throw new Error("Select at least one item first.");
  }
  return { profile_id: input.profile_id, ids: input.ids.slice(0, 200) };
}

/**
 * User-initiated deletion of their own unmapped items. Mapped work is never
 * removable in bulk: confirmed work stays protected.
 */
export const removeWorkItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateRemove)
  .handler(async ({ data, context }): Promise<{ removed: number; skipped: number }> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: rows, error } = await supabase
      .from("work_items")
      .select("id, content_ref, visibility, owner_id")
      .in("id", data.ids)
      .eq("owner_id", profile.id)
      .eq("visibility", "unmapped");
    if (error) throw new Error(error.message);

    const eligible = rows ?? [];
    const ids = eligible.map((r) => r.id);
    const skipped = data.ids.length - ids.length;
    if (ids.length === 0) return { removed: 0, skipped };

    const paths = eligible
      .map((r) => r.content_ref)
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    if (paths.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("work-files").remove(paths);
    }

    await supabase.from("turns").delete().in("work_item_id", ids);
    await supabase.from("work_item_tasks").delete().in("work_item_id", ids);
    const del = await supabase.from("work_items").delete().in("id", ids);
    if (del.error) throw new Error(del.error.message);

    return { removed: ids.length, skipped };
  });
