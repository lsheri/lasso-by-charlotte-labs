/**
 * Canvas Lab Phase 3 Slice 1: authenticated Workboard entry points.
 * Identity comes from the verified session; a client-sent profile id is a
 * request, verified by resolveProfile against the caller's own profiles.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WorkboardCommand, WorkboardDto, WorkboardMutationResult } from "@/lib/canvas-lab-shared";
import { resolveProfile } from "@/lib/profile-resolve";

export const getCanvasLabBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string; profile_id?: string }) => ({
    engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<WorkboardDto | null> => {
    if (!data.engagement_id) return null;
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return null;
    const { loadWorkboard } = await import("@/lib/canvas-lab.server");
    return loadWorkboard(supabase, data.engagement_id, profile);
  });

export const mutateCanvasLabBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string; command: WorkboardCommand; profile_id?: string }) => ({
    engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
    command: input?.command as WorkboardCommand,
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<WorkboardMutationResult> => {
    if (!data.engagement_id || !data.command?.type) return { status: "validation_error", message: "Nothing to save." };
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { status: "forbidden" };
    const { applyWorkboardCommand } = await import("@/lib/canvas-lab.server");
    return applyWorkboardCommand(supabase, data.engagement_id, profile, data.command);
  });
