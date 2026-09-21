/**
 * S1: the expiring board link, the entry points.
 *
 * Making, listing and expiring a link all need a verified session and run as
 * that person. Opening one does not, because the viewer has no account: that
 * single path takes a token and nothing else.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BoardShareLinkDto, SharedBoardResult } from "@/lib/board-share-shared";
import { resolveProfile } from "@/lib/profile-resolve";

export type CreateShareLinkAnswer =
  | { status: "created"; token: string; expiresAt: string }
  | { status: "forbidden" }
  | { status: "no_board" }
  | { status: "error" };

export const createBoardShareLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string; profile_id?: string }) => ({
    engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<CreateShareLinkAnswer> => {
    if (!data.engagement_id) return { status: "error" };
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) return { status: "forbidden" };
    const { createShareLink } = await import("@/lib/board-share.server");
    const result = await createShareLink(context.supabase, data.engagement_id, profile);
    if (result.status !== "created") return { status: result.status };
    const { recordEvent } = await import("@/lib/telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "board.share_link",
      orgId: result.orgId,
      userId: context.userId,
      profileId: profile.id,
      dims: { action: "created" },
    });
    return { status: "created", token: result.token, expiresAt: result.expiresAt };
  });

export const listBoardShareLinksFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string; profile_id?: string }) => ({
    engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ links: BoardShareLinkDto[]; holdsOthersWork: boolean; canShare: boolean }> => {
      const empty = { links: [], holdsOthersWork: false, canShare: false };
      if (!data.engagement_id) return empty;
      const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
      if (!profile) return empty;
      const { boardHoldsOthersWork, listShareLinks } = await import("@/lib/board-share.server");
      const { isEngagementEditor } = await import("@/lib/canvas-lab.server");
      const canShare = await isEngagementEditor(context.supabase, data.engagement_id, profile.id);
      if (!canShare) return empty;
      const [links, holdsOthersWork] = await Promise.all([
        listShareLinks(context.supabase, data.engagement_id),
        boardHoldsOthersWork(context.supabase, data.engagement_id, profile),
      ]);
      return { links, holdsOthersWork, canShare };
    },
  );

export const expireBoardShareLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { link_id: string; profile_id?: string }) => ({
    link_id: typeof input?.link_id === "string" ? input.link_id : "",
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }): Promise<{ status: "expired" | "not_found" }> => {
    if (!data.link_id) return { status: "not_found" };
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) return { status: "not_found" };
    const { expireShareLink } = await import("@/lib/board-share.server");
    const result = await expireShareLink(context.supabase, data.link_id);
    if (result.status !== "expired") return { status: "not_found" };
    const { recordEvent } = await import("@/lib/telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "board.share_link",
      orgId: result.orgId,
      userId: context.userId,
      profileId: profile.id,
      dims: { action: "revoked" },
    });
    return { status: "expired" };
  });

/**
 * The viewer has no session, so this one has no middleware. It takes a token
 * and returns one board or nothing, with the same answer either way.
 */
export const openSharedBoardFn = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({
    token: typeof input?.token === "string" ? input.token : "",
  }))
  .handler(async ({ data }): Promise<SharedBoardResult> => {
    const { openSharedBoard } = await import("@/lib/board-share-open.server");
    return openSharedBoard(data.token);
  });
