/**
 * S2 (stickies on the work): authenticated entry points. Identity comes from the verified session; a
 * client-sent profile id is a request, verified by resolveProfile against the caller's own profiles.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AnnotationVisibility } from "@/lib/canvas-lab-annotations-shared";
import { resolveProfile } from "@/lib/profile-resolve";
import {
  isStickyFill,
  type StickyAnchor,
  type StickyDto,
  type StickyMutationResult,
} from "@/lib/stickies-shared";

const str = (value: unknown) => (typeof value === "string" ? value : "");
const num = (value: unknown) => (typeof value === "number" ? value : Number.NaN);
const optNum = (value: unknown) => (typeof value === "number" ? value : undefined);
const vis = (value: unknown): AnnotationVisibility | undefined =>
  value === "just_me" || value === "engagement" ? value : undefined;

/** Only the fields an anchor of its kind can carry. */
function readAnchor(value: unknown): StickyAnchor | null {
  const raw = (value ?? {}) as {
    kind?: unknown;
    pageNo?: unknown;
    turnNo?: unknown;
    sectionKey?: unknown;
    rowKey?: unknown;
  };
  switch (raw.kind) {
    case "page":
      return { kind: "page", pageNo: num(raw.pageNo) };
    case "turn":
      return { kind: "turn", turnNo: num(raw.turnNo) };
    case "section":
      return { kind: "section", sectionKey: str(raw.sectionKey) };
    case "row":
      return { kind: "row", rowKey: str(raw.rowKey) };
    case "media":
      return { kind: "media" };
    case "item":
      return { kind: "item" };
    default:
      return null;
  }
}

export const listStickiesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { engagement_id: string; work_item_id: string; profile_id?: string }) => ({
      engagement_id: str(input?.engagement_id),
      work_item_id: str(input?.work_item_id),
      profile_id: str(input?.profile_id) || undefined,
    }),
  )
  .handler(async ({ data, context }): Promise<StickyDto[]> => {
    if (!data.engagement_id || !data.work_item_id) return [];
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return [];
    const { listStickies } = await import("@/lib/stickies.server");
    return listStickies(supabase, data.engagement_id, data.work_item_id, profile);
  });

export const createStickyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      engagement_id: string;
      work_item_id: string;
      anchor: StickyAnchor;
      pos_x: number;
      pos_y: number;
      fill: string;
      body: string;
      visibility: AnnotationVisibility;
      client_key: string;
      profile_id?: string;
    }) => ({
      engagement_id: str(input?.engagement_id),
      work_item_id: str(input?.work_item_id),
      anchor: readAnchor(input?.anchor),
      pos_x: num(input?.pos_x),
      pos_y: num(input?.pos_y),
      fill: isStickyFill(input?.fill) ? input.fill : "yellow",
      body: str(input?.body),
      visibility: vis(input?.visibility) ?? "engagement",
      client_key: str(input?.client_key),
      profile_id: str(input?.profile_id) || undefined,
    }),
  )
  .handler(async ({ data, context }): Promise<StickyMutationResult> => {
    if (!data.anchor)
      return { status: "validation_error", message: "That spot could not be read." };
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { status: "forbidden" };
    const { createSticky } = await import("@/lib/stickies.server");
    return createSticky(supabase, profile, {
      engagementId: data.engagement_id,
      workItemId: data.work_item_id,
      anchor: data.anchor,
      posX: data.pos_x,
      posY: data.pos_y,
      fill: data.fill,
      body: data.body,
      visibility: data.visibility,
      clientKey: data.client_key,
    });
  });

export const editStickyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      expected_version: number;
      body?: string;
      fill?: string;
      visibility?: AnnotationVisibility;
      pos_x?: number;
      pos_y?: number;
      profile_id?: string;
    }) => ({
      id: str(input?.id),
      expected_version: num(input?.expected_version),
      body: typeof input?.body === "string" ? input.body : undefined,
      fill: isStickyFill(input?.fill) ? input.fill : undefined,
      visibility: vis(input?.visibility),
      pos_x: optNum(input?.pos_x),
      pos_y: optNum(input?.pos_y),
      profile_id: str(input?.profile_id) || undefined,
    }),
  )
  .handler(async ({ data, context }): Promise<StickyMutationResult> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { status: "forbidden" };
    const { editSticky } = await import("@/lib/stickies.server");
    return editSticky(supabase, profile, {
      id: data.id,
      expectedVersion: data.expected_version,
      body: data.body,
      fill: data.fill,
      visibility: data.visibility,
      posX: data.pos_x,
      posY: data.pos_y,
    });
  });

export const archiveStickyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; expected_version: number; profile_id?: string }) => ({
    id: str(input?.id),
    expected_version: num(input?.expected_version),
    profile_id: str(input?.profile_id) || undefined,
  }))
  .handler(async ({ data, context }): Promise<StickyMutationResult> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { status: "forbidden" };
    const { archiveSticky } = await import("@/lib/stickies.server");
    return archiveSticky(supabase, profile, data.id, data.expected_version);
  });

export const listStickyCountsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string }) => ({
    engagement_id: str(input?.engagement_id),
  }))
  .handler(async ({ data, context }): Promise<Record<string, number>> => {
    if (!data.engagement_id) return {};
    const { listStickyCounts } = await import("@/lib/stickies.server");
    return listStickyCounts(context.supabase, data.engagement_id);
  });
