import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { InviteEmailResult } from "./invites-shared";

type Client = SupabaseClient<Database>;

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
