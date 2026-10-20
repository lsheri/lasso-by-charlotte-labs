/** SH-5c/5d: invite anyone to a board by email, list and withdraw, preview and accept. */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";
import type { BoardInvitePreview } from "@/lib/board-invites-shared";

type Json = Record<string, unknown>;

function asObject(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

const LEVELS = ["review", "work"] as const;
const CONVOS = ["summaries", "full"] as const;

export type OpenBoardInvite = {
  id: string;
  email: string;
  level: string;
  conversations: string;
  status: "sent" | "pending_approval";
  createdAt?: string | null;
};

export const inviteToBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { engagementId: string; email: string; level: string; conversations: string }) => ({
      engagementId: String(input?.engagementId ?? ""),
      email: String(input?.email ?? "").trim(),
      level: (LEVELS as readonly string[]).includes(input?.level) ? input.level : "review",
      conversations: (CONVOS as readonly string[]).includes(input?.conversations)
        ? input.conversations
        : "summaries",
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: raw, error } = await context.supabase.rpc("create_board_invite", {
      p_engagement: data.engagementId,
      p_email: data.email,
      p_level: data.level,
      p_conversations: data.conversations,
    });
    if (error) return { ok: false as const, error: error.message };
    const result = asObject(raw);
    const id = String(result["id"] ?? "");
    const status = String(result["status"] ?? "");
    const kind = String(result["kind"] ?? "");
    let emailed = false;
    if (result["code"] && id) {
      const { sendBoardInviteEmail } = await import("@/lib/board-invite-email.server");
      emailed = (await sendBoardInviteEmail(id)).sent;
    } else if (status === "pending_approval" && id) {
      const { sendInviteApprovalEmails } = await import("@/lib/board-invite-email.server");
      emailed = await sendInviteApprovalEmails(id, context.userId);
    }
    try {
      const { data: eng } = await context.supabase
        .from("engagements").select("org_id").eq("id", data.engagementId).maybeSingle();
      const profile = await resolveProfile(context.supabase, context.userId, undefined, eng?.org_id ?? undefined);
      if (profile) {
        const { recordEvent } = await import("@/lib/telemetry.server");
        await recordEvent(context.supabase, {
          eventType: "board.invite_sent",
          orgId: profile.org_id,
          userId: context.userId,
          profileId: profile.id,
          dims: { kind, status, level: data.level, conversations: data.conversations },
        });
      }
    } catch {
      /* telemetry never blocks the invite */
    }
    return { ok: true as const, status, emailed };
  });

export const listBoardInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagementId: string }) => ({ engagementId: String(input?.engagementId ?? "") }))
  .handler(async ({ data, context }): Promise<OpenBoardInvite[]> => {
    const { data: rows, error } = await context.supabase
      .from("board_invites")
      .select("id, email, level, conversations, status, expires_at, created_at")
      .eq("engagement_id", data.engagementId)
      .in("status", ["sent", "pending_approval"])
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) return [];
    return (rows ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      level: r.level,
      conversations: r.conversations,
      status: r.status as OpenBoardInvite["status"],
      createdAt: r.created_at ?? null,
    }));
  });

export const withdrawBoardInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { inviteId: string }) => ({ inviteId: String(input?.inviteId ?? "") }))
  .handler(async ({ data, context }) => {
    const { data: invite } = await context.supabase
      .from("board_invites").select("kind, org_id").eq("id", data.inviteId).maybeSingle();
    const { error } = await context.supabase.rpc("withdraw_board_invite", { p_invite: data.inviteId });
    if (error) return { ok: false as const, error: error.message };
    try {
      const profile = await resolveProfile(context.supabase, context.userId, undefined, invite?.org_id ?? undefined);
      if (profile) {
        const { recordEvent } = await import("@/lib/telemetry.server");
        await recordEvent(context.supabase, {
          eventType: "board.invite_withdrawn",
          orgId: profile.org_id,
          userId: context.userId,
          profileId: profile.id,
          dims: { kind: String(invite?.kind ?? "") },
        });
      }
    } catch {
      /* telemetry never blocks */
    }
    return { ok: true as const };
  });

/** Public: only what board_invite_preview returns, nothing more. */
export const previewBoardInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => ({ code: String(input?.code ?? "").slice(0, 200) }))
  .handler(async ({ data }): Promise<BoardInvitePreview> => {
    const empty: BoardInvitePreview = { state: "not_found", board: null, by: null, kind: null, email_hint: null, org: null };
    if (!data.code) return empty;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: raw, error } = await supabaseAdmin.rpc("board_invite_preview", { p_code: data.code });
    if (error) return empty;
    const r = asObject(raw);
    const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : null);
    return {
      state: (str("state") ?? "not_found") as BoardInvitePreview["state"],
      board: str("board"),
      by: str("by"),
      kind: str("kind"),
      email_hint: str("email_hint"),
      org: str("org"),
    };
  });

export const claimBoardInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; via?: string }) => ({
    code: String(input?.code ?? ""),
    via: input?.via === "signup" || input?.via === "signin" ? input.via : "direct",
  }))
  .handler(async ({ data, context }) => {
    const { data: raw, error } = await context.supabase.rpc("claim_board_invite", { p_code: data.code });
    if (error) return { ok: false as const, error: error.message };
    const r = asObject(raw);
    const engagementId = typeof r["engagement_id"] === "string" ? (r["engagement_id"] as string) : null;
    const kind = String(r["kind"] ?? "");
    let profileId: string | null = null;
    if (engagementId) {
      const { data: eng } = await context.supabase
        .from("engagements").select("org_id").eq("id", engagementId).maybeSingle();
      if (eng?.org_id) {
        const { data: prof } = await context.supabase
          .from("profiles").select("id").eq("user_id", context.userId).eq("org_id", eng.org_id)
          .is("deactivated_at", null).maybeSingle();
        profileId = prof?.id ?? null;
        try {
          const profile = await resolveProfile(context.supabase, context.userId, profileId, eng.org_id);
          if (profile) {
            const { recordEvent } = await import("@/lib/telemetry.server");
            await recordEvent(context.supabase, {
              eventType: "board.invite_accepted",
              orgId: profile.org_id,
              userId: context.userId,
              profileId: profile.id,
              dims: { kind, via: data.via },
            });
          }
        } catch {
          /* telemetry never blocks */
        }
      }
    }
    return { ok: true as const, status: String(r["status"] ?? ""), engagementId, profileId };
  });

/**
 * AU-1 (B1): public, called by sign up before an account exists. Returns only
 * whether the typed address matches and a masked hint, never the address.
 * A refusal records invite.blocked with state board_email_mismatch.
 */
export const checkBoardInviteSignup = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; email: string }) => ({
    code: String(input?.code ?? "").slice(0, 200),
    email: String(input?.email ?? "").slice(0, 320),
  }))
  .handler(async ({ data }): Promise<{ matches: boolean; email_hint: string | null }> => {
    const { maskEmail } = await import("@/lib/board-invites-shared");
    if (!data.code) return { matches: true, email_hint: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data: row } = await admin
      .from("board_invites").select("email, org_id").eq("code", data.code).maybeSingle();
    // No such invite: the accept page already says so; sign up is not blocked here.
    if (!row?.email) return { matches: true, email_hint: null };
    const norm = (v: string) => v.trim().toLowerCase();
    if (norm(row.email) === norm(data.email)) return { matches: true, email_hint: null };
    try {
      const { recordEvent } = await import("@/lib/telemetry.server");
      await recordEvent(supabaseAdmin, {
        eventType: "invite.blocked",
        orgId: row.org_id,
        userId: null,
        dims: { state: "board_email_mismatch" },
      });
    } catch {
      /* telemetry never blocks */
    }
    return { matches: false, email_hint: maskEmail(row.email) };
  });
