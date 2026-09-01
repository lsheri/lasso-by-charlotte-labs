import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { InviteEmailResult } from "./invites-shared";

type Client = SupabaseClient<Database>;

/** Falls back to the canonical sending address when only the key is set. */
export function inviteSenderAddress(): string {
  const configured = process.env["RESEND_FROM"];
  if (configured) return configured;
  const domain = process.env["INVITE_EMAIL_DOMAIN"] ?? "lasso.charlotte-labs.com";
  return `Lasso <invites@${domain}>`;
}

const SENDER_DOMAIN = "notify.lasso.charlotte-labs.com";
const PLATFORM_FROM = "Lasso <noreply@lasso.charlotte-labs.com>";

/**
 * Sends the invitation. The platform path is primary, a directly configured
 * Resend key is the secondary path, and no transport at all is not an error:
 * the caller shows the copyable link instead.
 */
export async function sendInviteEmail(args: {
  to: string;
  inviterName: string;
  acceptUrl: string;
  orgName?: string | undefined;
}): Promise<InviteEmailResult> {
  const { renderInviteEmail } = await import("./invite-email");
  const { subject, text, html } = renderInviteEmail({
    inviterName: args.inviterName,
    orgName: args.orgName || "your organization",
    acceptUrl: args.acceptUrl,
  });

  const platformKey = process.env["LOVABLE_API_KEY"];
  if (platformKey) {
    try {
      const { sendLovableEmail } = await import("@lovable.dev/email-js");
      await sendLovableEmail(
        {
          to: args.to,
          from: PLATFORM_FROM,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: "transactional",
          label: "org-invite",
          idempotency_key: `org-invite-${args.acceptUrl}`,
        },
        { apiKey: platformKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
      );
      return { sent: true, reason: "sent", message: null };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (!process.env["RESEND_API_KEY"]) {
        return { sent: false, reason: "failed", message: detail.slice(0, 300) };
      }
    }
  }

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    return { sent: false, reason: "not_configured", message: null };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: inviteSenderAddress(),
      to: [args.to],
      subject,
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

/**
 * Reads the invite behind a sign up attempt with the admin client and answers
 * only whether it may be used. Never says whether an address has an account.
 */
export async function checkSignupInviteByCode(
  code: string,
  email: string | null,
): Promise<import("./signup-invite").SignupInviteCheck> {
  const { evaluateSignupInvite } = await import("./signup-invite");
  if (!code || !/^[a-zA-Z0-9-]{4,64}$/.test(code)) {
    return evaluateSignupInvite(null, email);
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: invite } = await supabaseAdmin
    .from("invites")
    .select("code, org_id, email, expires_at, used_at, revoked_at")
    .eq("code", code)
    .maybeSingle();
  if (!invite) return evaluateSignupInvite(null, email);

  const { data: org } = await supabaseAdmin
    .from("orgs")
    .select("name")
    .eq("id", invite.org_id)
    .maybeSingle();

  return evaluateSignupInvite(invite, email, new Date(), org?.name ?? null);
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
    supabaseAdmin.from("orgs").select("name, settings").eq("id", invite.org_id).maybeSingle(),
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
  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const orgIsCompany = settings["type"] === "company";

  // A personal workspace has no company to name, so the welcome names the
  // person instead. Only for an email bound invite, where the link holder is
  // the presumed recipient, never for an open link.
  let inviterName: string | null = null;
  if (!orgIsCompany && invite.email && invite.created_by) {
    const { data: inviter } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", invite.created_by)
      .eq("org_id", invite.org_id)
      .maybeSingle();
    inviterName = inviter?.display_name ?? null;
  }

  // The bound address is revealed only to the person it is bound to. Any other
  // signed in link holder sees the same masked hint an anonymous one sees.
  const emailMatches = emailsMatch(invite.email, viewer?.email ?? null);
  return {
    status: resolveInviteStatus(invite),
    invited_role: invite.invited_role,
    org_name: org?.name ?? null,
    org_is_company: orgIsCompany,
    inviter_name: inviterName,
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
