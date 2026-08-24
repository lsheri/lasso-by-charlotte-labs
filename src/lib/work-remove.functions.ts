import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RemoveInput = { work_item_id: string; engagement_id: string };
type DeleteInput = { work_item_id: string };

function validateRemove(input: RemoveInput): RemoveInput {
  if (!input?.work_item_id) throw new Error("work_item_id is required");
  if (!input?.engagement_id) throw new Error("engagement_id is required");
  return { work_item_id: input.work_item_id, engagement_id: input.engagement_id };
}

function validateDelete(input: DeleteInput): DeleteInput {
  if (!input?.work_item_id) throw new Error("work_item_id is required");
  return { work_item_id: input.work_item_id };
}

/** Owner-only, and reversible through Connect to work: nothing is deleted. */
export const removeItemFromEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateRemove)
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile || profile.role === "coach") throw new Response("Forbidden", { status: 403 });

    const { removeFromEngagement } = await import("./work-remove.server");
    const result = await removeFromEngagement(context.supabase, {
      workItemId: data.work_item_id,
      engagementId: data.engagement_id,
      profileId: profile.id,
    });

    const { logHealth } = await import("@/lib/health.server");
    void logHealth({
      kind: "anomaly",
      surface: "work_item",
      ownerId: profile.id,
      detail: "engagement_unmapped",
      meta: {
        work_item_id: data.work_item_id,
        removed: result.removed,
        still_mapped_elsewhere: result.still_mapped_elsewhere,
      },
    });

    return result;
  });

/** Owner-only and permanent: storage objects first, then the row. */
export const deleteWorkItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateDelete)
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile || profile.role === "coach") throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deleteWorkItemRow } = await import("./work-remove.server");
    const result = await deleteWorkItemRow(context.supabase, supabaseAdmin as never, {
      workItemId: data.work_item_id,
      profileId: profile.id,
    });

    const { logHealth } = await import("@/lib/health.server");
    void logHealth({
      kind: "anomaly",
      surface: "work_item",
      ownerId: profile.id,
      detail: "work_item_deleted",
      meta: { work_item_id: data.work_item_id, objects: result.objects },
    });

    return result;
  });
