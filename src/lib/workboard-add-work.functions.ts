/**
 * B2: bring existing work onto an engagement's workboard.
 *
 * Placement only. Nothing here rewrites an item's visibility or removes an
 * existing placement: the database trigger does the first and nobody asked for
 * the second. Every read and write runs as the signed-in person, so the row
 * policies decide what is allowed.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlaceWorkResult = {
  taskId: string;
  /** Ids that now have a placement on this engagement because of this call. */
  placed: string[];
  /** Ids that were already on this engagement, left exactly as they were. */
  alreadyHere: string[];
};

type PlaceInput = { engagement_id: string; work_item_ids: string[]; profile_id?: string | undefined };

function validate(input: PlaceInput): PlaceInput {
  if (!input?.engagement_id) throw new Error("Choose an engagement first.");
  const ids = Array.isArray(input.work_item_ids) ? input.work_item_ids.filter(Boolean).slice(0, 100) : [];
  if (ids.length === 0) throw new Error("Choose at least one piece of work first.");
  return { engagement_id: input.engagement_id, work_item_ids: ids, profile_id: input.profile_id };
}

export const placeWorkOnBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<PlaceWorkResult> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const home = await supabase.rpc("ensure_board_default_task", { p_engagement: data.engagement_id });
    if (home.error) throw new Error(home.error.message);
    const taskId = home.data as unknown as string;
    if (!taskId) throw new Error("This engagement has no home for loose work yet.");

    const existing = await supabase
      .from("work_item_tasks")
      .select("work_item_id, tasks!inner(engagement_id)")
      .in("work_item_id", data.work_item_ids)
      .eq("tasks.engagement_id", data.engagement_id);
    if (existing.error) throw new Error(existing.error.message);
    const alreadyHere = new Set((existing.data ?? []).map((row) => row.work_item_id as string));

    const toPlace = data.work_item_ids.filter((id) => !alreadyHere.has(id));
    if (toPlace.length > 0) {
      const insert = await supabase
        .from("work_item_tasks")
        .insert(toPlace.map((id) => ({ work_item_id: id, task_id: taskId })));
      if (insert.error) throw new Error(insert.error.message);
    }

    return { taskId, placed: toPlace, alreadyHere: [...alreadyHere] };
  });
