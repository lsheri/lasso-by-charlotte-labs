/** NC-2: the notification bell's entry points. All run as the signed-in person (RLS). */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isNotificationKind, type NotificationRow } from "@/lib/notifications-shared";
import { resolveProfile } from "@/lib/profile-resolve";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const listMyNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationRow[]> => {
    const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, org_id, kind, section, subject_type, subject_id, payload, created_at, read_at, acted_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const inviteIds = rows
      .filter((r) => r.subject_type === "board_invite" && r.subject_id)
      .map((r) => r.subject_id as string);
    const boardByInvite = new Map<string, string>();
    if (inviteIds.length) {
      const { data: invites } = await context.supabase
        .from("board_invites")
        .select("id, engagement_id")
        .in("id", inviteIds);
      for (const i of (invites ?? []) as { id: string; engagement_id: string | null }[]) {
        if (i.engagement_id) boardByInvite.set(i.id, i.engagement_id);
      }
    }
    return rows.map((r) => {
      const payload =
        r.payload && typeof r.payload === "object" && !Array.isArray(r.payload)
          ? (r.payload as NotificationRow["payload"])
          : {};
      let engagementId: string | null = null;
      if (r.subject_type === "board_invite" && r.subject_id) {
        engagementId = boardByInvite.get(r.subject_id) ?? null;
      } else if ((r.subject_type === "engagement" || r.subject_type === "board") && r.subject_id) {
        engagementId = r.subject_id;
      }
      return { ...r, payload, engagement_id: engagementId };
    });
  });

export const markNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[]; acted: boolean }) => ({
    ids: Array.isArray(input?.ids) ? input.ids.filter((x) => typeof x === "string").slice(0, 100) : [],
    acted: input?.acted === true,
  }))
  .handler(async ({ data, context }): Promise<{ count: number }> => {
    if (!data.ids.length) return { count: 0 };
    const { data: n, error } = await context.supabase.rpc("mark_notifications", {
      p_ids: data.ids,
      p_acted: data.acted,
    });
    if (error) throw new Error(error.message);
    return { count: typeof n === "number" ? n : 0 };
  });

export type DecideInviteAnswer =
  | { ok: true; status: string; emailed: boolean }
  | { ok: false; message: string };

export const decideInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { inviteId: string; approve: boolean }) => ({
    inviteId: typeof input?.inviteId === "string" ? input.inviteId : "",
    approve: input?.approve === true,
  }))
  .handler(async ({ data, context }): Promise<DecideInviteAnswer> => {
    if (!data.inviteId) return { ok: false, message: "This invite could not be found." };
    const { data: out, error } = await context.supabase.rpc("decide_board_invite", {
      p_invite: data.inviteId,
      p_approve: data.approve,
    });
    if (error) return { ok: false, message: error.message.split("\n")[0] ?? "Something went wrong." };
    const result = (out ?? {}) as { status?: string; code?: string | null };
    let emailed = false;
    if (result.code) {
      const { sendBoardInviteEmail } = await import("@/lib/board-invite-email.server");
      emailed = (await sendBoardInviteEmail(data.inviteId)).sent;
    }
    return { ok: true, status: result.status ?? (data.approve ? "approved" : "declined"), emailed };
  });

export const recordNotificationOpened = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { hasNeedsYou: boolean; profile_id?: string }) => ({
    hasNeedsYou: input?.hasNeedsYou === true,
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }) => {
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) return { ok: false };
    const { recordEvent } = await import("@/lib/telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "notification.opened",
      orgId: profile.org_id,
      userId: context.userId,
      profileId: profile.id,
      dims: { needs_you: data.hasNeedsYou ? "some" : "none" },
    });
    return { ok: true };
  });

export const recordNotificationActed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string; action: string; profile_id?: string }) => ({
    kind: typeof input?.kind === "string" ? input.kind : "",
    action: typeof input?.action === "string" ? input.action : "",
    profile_id: typeof input?.profile_id === "string" ? input.profile_id : undefined,
  }))
  .handler(async ({ data, context }) => {
    if (!isNotificationKind(data.kind)) return { ok: false };
    if (!["approve", "decline", "open", "accept"].includes(data.action)) return { ok: false };
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) return { ok: false };
    const { recordEvent } = await import("@/lib/telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "notification.acted",
      orgId: profile.org_id,
      userId: context.userId,
      profileId: profile.id,
      dims: { kind: data.kind, action: data.action },
    });
    return { ok: true };
  });
