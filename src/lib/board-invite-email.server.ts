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

/** Resend inserts template variables raw, so anything a person typed is escaped. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
