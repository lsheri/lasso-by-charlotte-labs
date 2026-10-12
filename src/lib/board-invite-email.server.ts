/** NC-2: the email a board invite sends once an admin approves it. */

import { CANONICAL_ORIGIN } from "./app-host";
import { resendApiKey, sendResendTemplate } from "./invites.server";

export function buildBoardInviteUrl(code: string, origin: string = CANONICAL_ORIGIN): string {
  const url = new URL("/board-invite", origin);
  url.searchParams.set("code", code);
  return url.toString();
}

export function boardAccessLine(level: string, conversations: string): string {
  const full = conversations === "full";
  if (level === "work") {
    return full
      ? "You can add and edit cards, and see the full AI conversations."
      : "You can add and edit cards, and see their summaries.";
  }
  return full
    ? "You can view the cards, their summaries and the full AI conversations."
    : "You can view the cards and their summaries.";
}

export { escapeHtml } from "./escape-html";
import { escapeHtml } from "./escape-html";

export async function sendBoardInviteEmail(inviteId: string): Promise<{ sent: boolean }> {
  try {
    const key = resendApiKey();
    if (!key) return { sent: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data: invite } = await admin
      .from("board_invites")
      .select("id, code, email, level, conversations, engagement_id, invited_by")
      .eq("id", inviteId)
      .maybeSingle();
    if (!invite?.code || !invite?.email) return { sent: false };
    const [{ data: board }, { data: inviter }] = await Promise.all([
      admin.from("engagements").select("title").eq("id", invite.engagement_id).maybeSingle(),
      invite.invited_by
        ? admin.from("profiles").select("display_name").eq("id", invite.invited_by).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const result = await sendResendTemplate(key, {
      to: invite.email,
      template: "board-invite",
      variables: {
        INVITER_NAME: escapeHtml(String(inviter?.display_name ?? "Someone")),
        BOARD_NAME: escapeHtml(String(board?.title ?? "a board")),
        ACCESS_LINE: boardAccessLine(invite.level, invite.conversations),
        ACCEPT_URL: buildBoardInviteUrl(invite.code),
      },
    });
    if (!result.ok) console.error("[board-invite] send failed", { status: result.status });
    return { sent: result.ok };
  } catch (e) {
    console.error("[board-invite] send threw", { message: (e as Error).message });
    return { sent: false };
  }
}

/** SH-5c: where an admin lands to approve; the bell opens itself there. */
export function buildReviewUrl(origin: string = CANONICAL_ORIGIN): string {
  const url = new URL("/home", origin);
  url.searchParams.set("notifications", "open");
  return url.toString();
}

/**
 * SH-5c: an invite waiting for approval emails every active admin of the
 * board's workspace, never the inviter. Returns whether at least one sent.
 */
export async function sendInviteApprovalEmails(inviteId: string, inviterUserId: string): Promise<boolean> {
  try {
    const key = resendApiKey();
    if (!key) return false;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      from: (t: string) => any;
      auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string } | null } }> } };
    };
    const { data: invite } = await admin
      .from("board_invites")
      .select("id, email, org_id, engagement_id, invited_by")
      .eq("id", inviteId)
      .maybeSingle();
    if (!invite?.email) return false;
    const [{ data: board }, { data: org }, { data: inviter }, { data: admins }] = await Promise.all([
      admin.from("engagements").select("title").eq("id", invite.engagement_id).maybeSingle(),
      admin.from("orgs").select("name").eq("id", invite.org_id).maybeSingle(),
      admin.from("profiles").select("display_name").eq("id", invite.invited_by).maybeSingle(),
      admin.from("profiles").select("user_id").eq("org_id", invite.org_id).eq("role", "admin").is("deactivated_at", null),
    ]);
    const userIds = Array.from(
      new Set(((admins ?? []) as { user_id: string | null }[]).map((a) => a.user_id).filter((u): u is string => !!u && u !== inviterUserId)),
    );
    let any = false;
    for (const uid of userIds) {
      const { data } = await admin.auth.admin.getUserById(uid);
      const to = data.user?.email;
      if (!to) continue;
      const result = await sendResendTemplate(key, {
        to,
        template: "invite-approval-needed",
        variables: {
          INVITER_NAME: escapeHtml(String(inviter?.display_name ?? "Someone")),
          INVITEE_EMAIL: escapeHtml(String(invite.email)),
          BOARD_NAME: escapeHtml(String(board?.title ?? "a board")),
          ORG_NAME: escapeHtml(String(org?.name ?? "your workspace")),
          REVIEW_URL: buildReviewUrl(),
        },
      });
      if (result.ok) any = true;
      else console.error("[board-invite] approval send failed", { status: result.status });
    }
    return any;
  } catch (e) {
    console.error("[board-invite] approval send threw", { message: (e as Error).message });
    return false;
  }
}
