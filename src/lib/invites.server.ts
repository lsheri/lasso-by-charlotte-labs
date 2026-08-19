import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { InviteEmailResult } from "./invites-shared";

type Client = SupabaseClient<Database>;

/**
 * Email clients ignore CSS custom properties, so the app palette is mirrored
 * here as one small token map, the only place literals may appear in email.
 */
const MAIL = {
  card: "#ffffff",
  ink: "#16302b",
  muted: "#4f6260",
  cta: "#2bd97b",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function body(inviter: string, url: string) {
  const roleLine =
    "Lasso is where they keep a record of the work they do with AI, so someone can coach it.";
  const text = [
    `${inviter} invited you to Lasso.`,
    "",
    roleLine,
    "You will only ever see the work they choose to share with you.",
    "Nothing else in their workspace is visible to you.",
    "",
    `Accept the invitation: ${url}`,
    "",
    "Charlotte Labs",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:${MAIL.card};font-family:Helvetica,Arial,sans-serif;color:${MAIL.ink}">
<div style="max-width:520px;margin:0 auto">
<p style="font-size:15px;line-height:1.6">${escapeHtml(inviter)} invited you to Lasso.</p>
<p style="font-size:15px;line-height:1.6">${escapeHtml(roleLine)} You will only ever see the work they choose to share with you. Nothing else in their workspace is visible to you.</p>
<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:${MAIL.cta};color:${MAIL.ink};text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">Accept the invitation</a></p>
<p style="font-size:13px;line-height:1.6;color:${MAIL.muted}">Or paste this link into your browser:<br>${escapeHtml(url)}</p>
<p style="font-size:12px;color:${MAIL.muted};margin-top:32px">Charlotte Labs</p>
</div></body></html>`;

  return { text, html };
}

/** Sends the invitation through Resend. Missing secrets are not an error. */
export async function sendInviteViaResend(args: {
  to: string;
  inviterName: string;
  acceptUrl: string;
}): Promise<InviteEmailResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM"];
  if (!apiKey || !from) {
    return { sent: false, reason: "not_configured", message: null };
  }

  const { text, html } = body(args.inviterName, args.acceptUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: `${args.inviterName} invited you to review their work on Lasso`,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      sent: false,
      reason: "failed",
      message: `Email provider returned ${response.status}: ${detail.slice(0, 300)}`,
    };
  }
  return { sent: true, reason: "sent", message: null };
}

/** The invite must belong to the caller's org before anything is emailed. */
export async function assertInviteInOrg(supabase: Client, code: string, orgId: string) {
  const { data, error } = await supabase
    .from("invites")
    .select("code, org_id")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.org_id !== orgId) throw new Error("That invite is not yours to send.");
}

/**
 * Reads one invite with the admin client and projects the minimum an accept
 * page needs. The projection never includes the org id, never says whether an
 * address has an account, and only reveals the bound address to a signed in
 * caller. Unknown and malformed codes return the identical not-found shape.
 */
export async function loadInviteState(
  code: string,
  engagementId: string | null,
  viewer: { userId: string; email: string | null } | null,
): Promise<import("./invite-state").InviteState> {
  const { notFoundState, resolveInviteStatus, maskEmail, emailsMatch } = await import(
    "./invite-state"
  );
  const signedIn = Boolean(viewer);
  if (!code || !/^[a-zA-Z0-9-]{4,64}$/.test(code)) return notFoundState(signedIn);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: invite } = await supabaseAdmin
    .from("invites")
    .select("code, org_id, invited_role, email, created_by, expires_at, used_at, revoked_at")
    .eq("code", code)
    .maybeSingle();
  if (!invite) return notFoundState(signedIn);

  const [{ data: org }, { data: engagement }, { data: mine }] = await Promise.all([
    supabaseAdmin.from("orgs").select("name").eq("id", invite.org_id).maybeSingle(),
    engagementId
      ? supabaseAdmin
          .from("engagements")
          .select("title")
          .eq("id", engagementId)
          // Scoped to the invite's org: the caller supplies this id and is not
          // yet a member, so an unscoped read would expose other orgs' titles.
          .eq("org_id", invite.org_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { title: string } | null }),
    viewer
      ? supabaseAdmin.from("profiles").select("id, org_id").eq("user_id", viewer.userId)
      : Promise.resolve({ data: null as { id: string; org_id: string }[] | null }),
  ]);

  const profiles = mine ?? [];
  // The bound address is revealed only to the person it is bound to. Any other
  // signed in link holder sees the same masked hint an anonymous one sees.
  const emailMatches = emailsMatch(invite.email, viewer?.email ?? null);
  return {
    status: resolveInviteStatus(invite),
    invited_role: invite.invited_role,
    org_name: org?.name ?? null,
    is_email_bound: Boolean(invite.email),
    email: emailMatches ? invite.email : null,
    email_hint: maskEmail(invite.email),
    created_by_you: Boolean(
      invite.created_by && profiles.some((row) => row.id === invite.created_by),
    ),
    expires_at: invite.expires_at,
    engagement_title: engagement?.title ?? null,
    viewer: {
      signed_in: signedIn,
      is_member: profiles.some((row) => row.org_id === invite.org_id),
      email_matches: emailMatches,
    },
  };
}

/** Resolves the invite's org server-side so the client never handles an org id. */
export async function recordInviteBlockedByCode(code: string, state: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: invite } = await supabaseAdmin
    .from("invites")
    .select("org_id")
    .eq("code", code)
    .maybeSingle();
  if (!invite) return;
  const { recordEvent } = await import("./telemetry.server");
  await recordEvent(supabaseAdmin, {
    eventType: "invite.blocked",
    orgId: invite.org_id,
    userId: null,
    dims: { state },
  });
}
