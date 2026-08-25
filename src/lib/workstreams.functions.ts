import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type DeleteInput = { task_id: string };
type MoveInput = { task_id: string; engagement_id: string; direction: "left" | "right" };
type RenameInput = { task_id: string; name: string };

function validateDelete(input: DeleteInput): DeleteInput {
  if (!input?.task_id) throw new Error("task_id is required");
  return { task_id: input.task_id };
}

function validateMove(input: MoveInput): MoveInput {
  if (!input?.task_id) throw new Error("task_id is required");
  if (!input?.engagement_id) throw new Error("engagement_id is required");
  if (input.direction !== "left" && input.direction !== "right") {
    throw new Error("direction must be left or right");
  }
  return { task_id: input.task_id, engagement_id: input.engagement_id, direction: input.direction };
}

function validateRename(input: RenameInput): RenameInput {
  const name = (input?.name ?? "").trim();
  if (!input?.task_id) throw new Error("task_id is required");
  if (!name) throw new Error("A workstream needs a name");
  return { task_id: input.task_id, name };
}

/** Members only. Coaches never manage somebody else's workstreams. */
async function requireMember(context: {
  supabase: { from: (table: string) => never };
  userId: string;
}) {
  const supabase = context.supabase as unknown as {
    from: (table: "profiles") => {
      select: (cols: string) => {
        eq: (
          col: string,
          value: string,
        ) => { maybeSingle: () => Promise<{ data: { id: string; role: string } | null }> };
      };
    };
  };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!profile || profile.role === "coach") throw new Response("Forbidden", { status: 403 });
  return profile;
}

export const deleteWorkstream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateDelete)
  .handler(async ({ data, context }) => {
    await requireMember(context as unknown as Parameters<typeof requireMember>[0]);
    const { deleteWorkstreamRow } = await import("./workstreams.server");
    return deleteWorkstreamRow(context.supabase, { taskId: data.task_id });
  });

export const moveWorkstream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateMove)
  .handler(async ({ data, context }) => {
    await requireMember(context as unknown as Parameters<typeof requireMember>[0]);
    const { swappedPositions } = await import("./workstreams.server");

    const { data: tasks, error } = await context.supabase
      .from("tasks")
      .select("id, position, created_at")
      .eq("engagement_id", data.engagement_id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ordered = (tasks ?? []) as { id: string; position: number | null }[];
    const swap = swappedPositions(ordered, data.task_id, data.direction);
    if (!swap) return { moved: false as const };

    // Renumber the whole row so positions stay dense after the swap.
    const positions = new Map(swap.map((row) => [row.id, row.position]));
    for (const [index, task] of ordered.entries()) {
      const next = positions.get(task.id) ?? index;
      if (task.position === next) continue;
      const update = await context.supabase
        .from("tasks")
        .update({ position: next })
        .eq("id", task.id);
      if (update.error) throw new Error(update.error.message);
    }
    return { moved: true as const };
  });

export const renameWorkstream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateRename)
  .handler(async ({ data, context }) => {
    await requireMember(context as unknown as Parameters<typeof requireMember>[0]);
    const { error } = await context.supabase
      .from("tasks")
      .update({ name: data.name })
      .eq("id", data.task_id);
    if (error) throw new Error(error.message);
    return { renamed: true as const, name: data.name };
  });
