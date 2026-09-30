import { createFileRoute } from "@tanstack/react-router";
import { Webhook } from "standardwebhooks";

// Supabase Auth "Send Email Hook" receiver. Each action type sends a published
// Resend template by alias; the template supplies subject and from.

export type AuthEmailType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "reauthentication";

export const AUTH_EMAIL_ALIASES: Record<AuthEmailType, string> = {
  signup: "auth-signup",
  invite: "auth-invite",
  magiclink: "auth-magiclink",
  recovery: "auth-recovery",
  email_change: "auth-email-change",
  reauthentication: "auth-reauthentication",
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

// Never EMAIL, FIRST_NAME, LAST_NAME or RESEND_UNSUBSCRIBE_URL: Resend reserves them.
export type Outgoing = { to: string; template: string; variables: Record<string, string> };

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
  const template = AUTH_EMAIL_ALIASES[type];
  if (!template) return [];
  const email = payload.user.email;
  const url = verifyUrl(d.token_hash ?? "", type, d.redirect_to);
  switch (type) {
    case "signup":
    case "magiclink":
    case "recovery":
    // ORG_NAME is optional on auth-invite; nothing supplies it, so it is omitted.
    case "invite":
      return [{ to: email, template, variables: { CONFIRMATION_URL: url } }];
    case "reauthentication":
      return [{ to: email, template, variables: { TOKEN: d.token ?? "" } }];
    case "email_change": {
      const newEmail = payload.user.new_email ?? "";
      const make = (to: string, link: string): Outgoing => ({
        to,
        template,
        variables: { CONFIRMATION_URL: link, OLD_EMAIL: email, NEW_EMAIL: newEmail },
      });
      // Secure change: Supabase pairs token_hash_new with the current address
      // and token_hash with the new one. Two sends, never collapsed.
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
  const { sendResendTemplate } = await import("@/lib/invites.server");
  for (const mail of emails) {
    const result = await sendResendTemplate(apiKey, mail);
    if (!result.ok) {
      console.error(`[auth-email-hook] Resend ${result.status}: ${result.detail}`);
      return Response.json({ error: `email provider returned ${result.status}` }, { status: 502 });
    }
  }
  return Response.json({});
}

export const Route = createFileRoute("/api/public/auth-email-hook")({
  server: { handlers: { POST: ({ request }) => handleAuthEmailHook(request) } },
});
