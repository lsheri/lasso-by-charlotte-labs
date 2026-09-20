/**
 * Canvas Lab Phase 3 Slice 1: authenticated Workboard entry points.
 * Identity comes from the verified session; a client-sent profile id is a
 * request, verified by resolveProfile against the caller's own profiles.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  AnnotationMutationResult,
  AnnotationVisibility,

  CommentMutationResult,
  CommentThreadDto,
  HighlightDto,
} from "@/lib/canvas-lab-annotations-shared";
import type { WorkboardCommand, WorkboardDto, WorkboardMutationResult } from "@/lib/canvas-lab-shared";
import type { WorkboardCardPreview } from "@/lib/workboard-card-preview.shared";
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

export const getWorkboardCardPreviewsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string; work_item_ids: string[]; profile_id?: string }) => ({
    engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
    work_item_ids: Array.isArray(input?.work_item_ids)
      ? input.work_item_ids.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 100)
      : [],
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<WorkboardCardPreview[]> => {
    if (!data.engagement_id || data.work_item_ids.length === 0) return [];
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return [];
    const { readWorkboardCardPreviews } = await import("@/lib/workboard-card-preview.server");
    return readWorkboardCardPreviews(supabase, data.work_item_ids);
  });

/** Slice 2a unit 1: the caller's own highlights on one chat. */
export const listMyAnnotationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string; work_item_id: string; profile_id?: string }) => ({
    engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
    work_item_id: typeof input?.work_item_id === "string" ? input.work_item_id : "",
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<HighlightDto[]> => {
    if (!data.engagement_id || !data.work_item_id) return [];
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return [];
    const { listMyAnnotations } = await import("@/lib/canvas-lab-annotations.server");
    return listMyAnnotations(supabase, data.engagement_id, data.work_item_id, profile);
  });

export const createHighlightFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      engagement_id: string;
      work_item_id: string;
      turn_no: number;
      char_start: number;
      char_end: number;
      client_key: string;
      profile_id?: string;
    }) => ({
      engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
      work_item_id: typeof input?.work_item_id === "string" ? input.work_item_id : "",
      turn_no: typeof input?.turn_no === "number" ? input.turn_no : Number.NaN,
      char_start: typeof input?.char_start === "number" ? input.char_start : Number.NaN,
      char_end: typeof input?.char_end === "number" ? input.char_end : Number.NaN,
      client_key: typeof input?.client_key === "string" ? input.client_key : "",
      profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
    }),
  )
  .handler(async ({ data, context }): Promise<AnnotationMutationResult> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { status: "forbidden" };
    const { createHighlight } = await import("@/lib/canvas-lab-annotations.server");
    return createHighlight(supabase, profile, {
      engagementId: data.engagement_id,
      workItemId: data.work_item_id,
      turnNo: data.turn_no,
      charStart: data.char_start,
      charEnd: data.char_end,
      clientKey: data.client_key,
    });
  });

export const archiveHighlightFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; expected_version: number; profile_id?: string }) => ({
    id: typeof input?.id === "string" ? input.id : "",
    expected_version: typeof input?.expected_version === "number" ? input.expected_version : Number.NaN,
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<AnnotationMutationResult> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { status: "forbidden" };
    const { archiveHighlight } = await import("@/lib/canvas-lab-annotations.server");
    return archiveHighlight(supabase, profile, data.id, data.expected_version);
  });

/** Teammate visibility: the author alone flips one of their highlights. */
export const setHighlightVisibilityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; visibility: string; expected_version: number; profile_id?: string }) => ({
      id: typeof input?.id === "string" ? input.id : "",
      visibility: (input?.visibility === "just_me" ? "just_me" : "engagement") as AnnotationVisibility,
      expected_version: typeof input?.expected_version === "number" ? input.expected_version : Number.NaN,
      profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
    }),
  )
  .handler(async ({ data, context }): Promise<AnnotationMutationResult> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { status: "forbidden" };
    const { setHighlightVisibility } = await import("@/lib/canvas-lab-annotations.server");
    return setHighlightVisibility(supabase, profile, data.id, data.visibility, data.expected_version);
  });


/* Slice 2a unit 2: comments are review, so they are readable by everyone who
 * can already see the item. Only the author edits or removes their own. */

export const listCommentsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string; work_item_id: string; profile_id?: string }) => ({
    engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
    work_item_id: typeof input?.work_item_id === "string" ? input.work_item_id : "",
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<CommentThreadDto[]> => {
    if (!data.engagement_id || !data.work_item_id) return [];
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return [];
    const { listComments } = await import("@/lib/canvas-lab-annotations.server");
    return listComments(supabase, data.engagement_id, data.work_item_id, profile);
  });

export const listCommentCountsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string; profile_id?: string }) => ({
    engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<Record<string, number>> => {
    if (!data.engagement_id) return {};
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return {};
    const { listCommentCounts } = await import("@/lib/canvas-lab-annotations.server");
    return listCommentCounts(supabase, data.engagement_id);
  });

export const createCommentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      engagement_id: string;
      work_item_id: string;
      turn_no: number;
      char_start: number;
      char_end: number;
      body: string;
      client_key: string;
      profile_id?: string;
    }) => ({
      engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
      work_item_id: typeof input?.work_item_id === "string" ? input.work_item_id : "",
      turn_no: typeof input?.turn_no === "number" ? input.turn_no : Number.NaN,
      char_start: typeof input?.char_start === "number" ? input.char_start : Number.NaN,
      char_end: typeof input?.char_end === "number" ? input.char_end : Number.NaN,
      body: typeof input?.body === "string" ? input.body : "",
      client_key: typeof input?.client_key === "string" ? input.client_key : "",
      profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
    }),
  )
  .handler(async ({ data, context }): Promise<CommentMutationResult> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { status: "forbidden" };
    const { createComment } = await import("@/lib/canvas-lab-annotations.server");
    return createComment(supabase, profile, {
      engagementId: data.engagement_id,
      workItemId: data.work_item_id,
      turnNo: data.turn_no,
      charStart: data.char_start,
      charEnd: data.char_end,
      body: data.body,
      clientKey: data.client_key,
    });
  });

export const createReplyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { parent_id: string; body: string; client_key: string; profile_id?: string }) => ({
    parent_id: typeof input?.parent_id === "string" ? input.parent_id : "",
    body: typeof input?.body === "string" ? input.body : "",
    client_key: typeof input?.client_key === "string" ? input.client_key : "",
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<CommentMutationResult> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { status: "forbidden" };
    const { createReply } = await import("@/lib/canvas-lab-annotations.server");
    return createReply(supabase, profile, {
      parentId: data.parent_id,
      body: data.body,
      clientKey: data.client_key,
    });
  });

export const editCommentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; body: string; expected_version: number; profile_id?: string }) => ({
    id: typeof input?.id === "string" ? input.id : "",
    body: typeof input?.body === "string" ? input.body : "",
    expected_version: typeof input?.expected_version === "number" ? input.expected_version : Number.NaN,
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<CommentMutationResult> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { status: "forbidden" };
    const { editComment } = await import("@/lib/canvas-lab-annotations.server");
    return editComment(supabase, profile, data.id, data.body, data.expected_version);
  });

export const archiveCommentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; expected_version: number; profile_id?: string }) => ({
    id: typeof input?.id === "string" ? input.id : "",
    expected_version: typeof input?.expected_version === "number" ? input.expected_version : Number.NaN,
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<CommentMutationResult> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { status: "forbidden" };
    const { archiveComment } = await import("@/lib/canvas-lab-annotations.server");
    return archiveComment(supabase, profile, data.id, data.expected_version);
  });
