import * as React from "react";
import { render } from "@react-email/render";
import { createFileRoute } from "@tanstack/react-router";
import { Webhook } from "standardwebhooks";

import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";

// Supabase Auth "Send Email Hook" receiver, prepared for the move off the
// managed email path. Subjects match src/routes/lovable/email/auth/webhook.ts.

const SITE_NAME = "Lasso";
const SITE_URL = "https://lasso.charlotte-labs.com";
const DEFAULT_FROM = "Lasso <noreply@lasso.charlotte-labs.com>";

export type AuthEmailType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "reauthentication";

export const AUTH_EMAIL_SUBJECTS: Record<AuthEmailType, string> = {
  signup: "Confirm your email",
  invite: "You are invited",
  magiclink: "Your sign in link",
  recovery: "Reset your password",
  email_change: "Confirm your new email",
  reauthentication: "Your verification code",
};

export type HookPayload = {
  user: { email: string; new_email?: string | null };
  email_data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type: string;
    site_url?: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

type Outgoing = { to: string; subject: string; element: React.ReactElement };

function verifyUrl(tokenHash: string, type: string, redirectTo: string | undefined): string {
  const base = process.env["SUPABASE_URL"] ?? "";
  const params = new URLSearchParams({ token: tokenHash, type });
  if (redirectTo) params.set("redirect_to", redirectTo);
  return `${base}/auth/v1/verify?${params.toString()}`;
}

/** Maps one hook payload to the emails it should produce. Pure, for tests. */
export function buildAuthEmails(payload: HookPayload): Outgoing[] {
  const d = payload.email_data;
  const type = d.email_action_type as AuthEmailType;
  const subject = AUTH_EMAIL_SUBJECTS[type];
  if (!subject) return [];
  const email = payload.user.email;
  const url = verifyUrl(d.token_hash ?? "", type, d.redirect_to);
  switch (type) {
    case "signup":
      return [{ to: email, subject, element: React.createElement(SignupEmail, { siteName: SITE_NAME, siteUrl: SITE_URL, recipient: email, confirmationUrl: url }) }];
    case "invite":
      return [{ to: email, subject, element: React.createElement(InviteEmail, { siteName: SITE_NAME, siteUrl: SITE_URL, confirmationUrl: url }) }];
    case "magiclink":
      return [{ to: email, subject, element: React.createElement(MagicLinkEmail, { siteName: SITE_NAME, confirmationUrl: url }) }];
    case "recovery":
      return [{ to: email, subject, element: React.createElement(RecoveryEmail, { siteName: SITE_NAME, confirmationUrl: url }) }];
    case "reauthentication":
      return [{ to: email, subject, element: React.createElement(ReauthenticationEmail, { token: d.token ?? "" }) }];
    case "email_change": {
      const newEmail = payload.user.new_email ?? "";
      const make = (to: string, link: string) => ({
        to,
        subject,
        element: React.createElement(EmailChangeEmail, { siteName: SITE_NAME, oldEmail: email, email: to, newEmail, confirmationUrl: link }),
      });
      // Secure change: Supabase pairs token_hash_new with the current address
      // and token_hash with the new one.
      if (d.token_hash_new && newEmail) {
        return [
          make(email, verifyUrl(d.token_hash_new, type, d.redirect_to)),
          make(newEmail, url),
        ];
      }
      return [make(newEmail || email, url)];
    }
  }
}

export async function handleAuthEmailHook(request: Request): Promise<Response> {
  const secret = process.env["SEND_EMAIL_HOOK_SECRET"];
  if (!secret) {
    console.error("[auth-email-hook] SEND_EMAIL_HOOK_SECRET is not set; refusing to send");
    return Response.json({ error: "hook secret not configured" }, { status: 500 });
  }
  const body = await request.text();
  let payload: HookPayload;
  try {
    const wh = new Webhook(secret.replace(/^v1,whsec_/, ""));
    payload = wh.verify(body, {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
    }) as HookPayload;
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    console.error("[auth-email-hook] RESEND_API_KEY is not set");
    return Response.json({ error: "email provider not configured" }, { status: 500 });
  }
  const emails = buildAuthEmails(payload);
  if (emails.length === 0) {
    return Response.json({ error: "unknown email type" }, { status: 400 });
  }
  const { sendViaResend } = await import("@/lib/invites.server");
  const from = process.env["RESEND_FROM"] || DEFAULT_FROM;
  for (const mail of emails) {
    const html = await render(mail.element);
    const text = await render(mail.element, { plainText: true });
    const result = await sendViaResend(apiKey, { from, to: mail.to, subject: mail.subject, html, text });
    if (!result.ok) {
      console.error(`[auth-email-hook] Resend ${result.status}: ${result.detail}`);
      return Response.json({ error: `email provider returned ${result.status}` }, { status: 502 });
    }
  }
  return Response.json({});
}

export const Route = createFileRoute("/api/auth-email-hook")({
  server: { handlers: { POST: ({ request }) => handleAuthEmailHook(request) } },
});
