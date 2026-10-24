/**
 * MCP-WS-1: a connector adds a workstream to an existing board.
 *
 * In the app this is two writes: the tasks row, then the board outline that
 * draws it. The browser computes the outline's rectangle with
 * nextWorkstreamRect and persists it through applyWorkboardCommand as a
 * frame_create. This module does the same two writes server-side, so a
 * workstream added through a connector is drawn exactly where the app would
 * draw it. A task without its outline is listed but never drawn, so a frame
 * failure is reported, never swallowed.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { applyWorkboardCommand, ensureBoard } from "@/lib/canvas-lab.server";
import { workstreamTasks } from "@/lib/board-default-task";
import {
  nextWorkstreamRect,
  type LabFrame,
  type LabNode,
} from "@/components/canvas-lab/canvas-lab-model";
import type { ResolvedProfile } from "@/lib/profile-resolve";

export type CreateWorkstreamResult =
  | { status: "created"; taskId: string; name: string }
  | { status: "existing"; taskId: string; name: string }
  | { status: "failed"; reason: string; taskId?: string };

const NAME_MAX = 60;

export async function createWorkstreamWithFrame(input: {
  engagementId: string;
  profileId: string;
  name: string;
}): Promise<CreateWorkstreamResult> {
  const name = input.name.trim().slice(0, NAME_MAX);
  if (!name) return { status: "failed", reason: "name" };

  const { data: profileRow, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", input.profileId)
    .maybeSingle();
  if (profileError) return { status: "failed", reason: profileError.message };
  if (!profileRow) return { status: "failed", reason: "profile" };
  const profile = profileRow as ResolvedProfile;

  const { data: taskRows, error: tasksError } = await supabaseAdmin
    .from("tasks")
    .select("id, name, is_board_default, position")
    .eq("engagement_id", input.engagementId);
  if (tasksError) return { status: "failed", reason: tasksError.message };

  const existing = workstreamTasks(taskRows ?? []).find(
    (task) => task.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (existing) return { status: "existing", taskId: existing.id, name };

  const position =
    (taskRows ?? []).reduce((max, task) => Math.max(max, task.position ?? 0), 0) + 1;
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("tasks")
    .insert({
      engagement_id: input.engagementId,
      owner_id: input.profileId,
      name,
      status: "open",
      position,
    })
    .select("id")
    .single();
  if (insertError) return { status: "failed", reason: insertError.message };
  const taskId = inserted.id as string;

  const board = await ensureBoard(supabaseAdmin, input.engagementId, profile);
  if (!board) return { status: "failed", reason: "frame", taskId };

  const { data: frameRows, error: framesError } = await supabaseAdmin
    .from("workboard_frames")
    .select("key, label, x, y, w, h")
    .eq("workboard_id", board.id)
    .is("deleted_at", null);
  if (framesError) return { status: "failed", reason: "frame", taskId };

  const { data: nodeRows, error: nodesError } = await supabaseAdmin
    .from("workboard_nodes")
    .select("id, x, y, w, h")
    .eq("workboard_id", board.id)
    .is("deleted_at", null);
  if (nodesError) return { status: "failed", reason: "frame", taskId };

  const frames: LabFrame[] = (frameRows ?? []).map((row) => ({
    id: row.key,
    name: row.label ?? "",
    x: row.x,
    y: row.y,
    width: row.w,
    height: row.h,
  }));
  const nodes: LabNode[] = (nodeRows ?? []).map((row) => ({
    id: row.id,
    kind: "work",
    title: "",
    summary: "",
    typeLabel: "",
    ownership: "yours",
    x: row.x,
    y: row.y,
    width: row.w,
    height: row.h,
  }));
  const rect = nextWorkstreamRect(frames, nodes);

  try {
    const result = await applyWorkboardCommand(supabaseAdmin, input.engagementId, profile, {
      type: "frame_create",
      frame: {
        key: `task:${taskId}`,
        kind: "task",
        taskId,
        label: name,
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        ord: 0,
      },
    });
    if (result.status !== "saved") return { status: "failed", reason: "frame", taskId };
  } catch {
    return { status: "failed", reason: "frame", taskId };
  }

  return { status: "created", taskId, name };
}
