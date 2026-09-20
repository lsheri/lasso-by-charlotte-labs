import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";

type CreateInput = { engagement_id: string; name: string; profile_id?: string | null | undefined };
type MoveInput = { item_id: string; task_id: string; profile_id?: string | null | undefined };

function validateCreate(input: CreateInput): CreateInput {
  const name = (input?.name ?? "").trim();
  if (!input?.engagement_id) throw new Error("engagement_id is required");
  if (!name) throw new Error("A workstream needs a name");
  return { engagement_id: input.engagement_id, name, profile_id: input.profile_id ?? null };
}

function validateMove(input: MoveInput): MoveInput {
  if (!input?.item_id) throw new Error("item_id is required");
  if (!input?.task_id) throw new Error("task_id is required");
  return { item_id: input.item_id, task_id: input.task_id, profile_id: input.profile_id ?? null };
}

/** Arranging a board is members' work. A coach never draws a workstream. */
async function requireMember(
  context: { supabase: Parameters<typeof resolveProfile>[0]; userId: string },
  profileId: string | null | undefined,
) {
  const profile = await resolveProfile(context.supabase, context.userId, profileId);
  if (!profile || profile.role === "coach") throw new Response("Forbidden", { status: 403 });
  return profile;
}

/** A drawn workstream is an ordinary workstream row, the same as the details page adds. */
export const createDrawnWorkstreamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateCreate)
  .handler(async ({ data, context }) => {
    const profile = await requireMember(context, data.profile_id);
    const { data: row, error } = await context.supabase
      .from("tasks")
      .insert({ engagement_id: data.engagement_id, owner_id: profile.id, name: data.name })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, name: row.name as string };
  });

/**
 * One card into one workstream. The database decides whether the move is
 * allowed and reports back what it did, so the board never claims a placement
 * the database refused.
 */
export const moveItemToWorkstreamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateMove)
  .handler(async ({ data, context }) => {
    await requireMember(context, data.profile_id);
    const { data: result, error } = await context.supabase.rpc("move_item_to_workstream", {
      p_item: data.item_id,
      p_task: data.task_id,
    });
    if (error) {
      if (error.code === "42501") return { status: "refused" as const };
      throw new Error(error.message);
    }
    const payload = (result ?? {}) as { status?: string; from?: string | null };
    return { status: (payload.status ?? "placed") as "placed" | "moved" | "already_here" };
  });
