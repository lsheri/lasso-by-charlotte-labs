import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  INVITE_ADMIN_ONLY_LINE,
  INVITE_BLOCKED_STATES,
  type CreateInviteResult,
  type InviteEmailResult,
} from "./invites-shared";
import type { InviteState } from "./invite-state";

/**
 * Public on purpose: the accept page must render honest states before anyone
 * signs in. The handler proves the session from the bearer header when there
 * is one, and the projection is minimal either way.
 */
export const getInviteState = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; eng?: string | undefined }) => input)
  .handler(async ({ data }): Promise<InviteState> => {
    const { readOptionalViewer } = await import("./invite-viewer.server");
    const { loadInviteState } = await import("./invites.server");
    const viewer = await readOptionalViewer();
    return loadInviteState(data.code ?? "", data.eng ?? null, viewer);
  });

/**
 * Content-free record of an accept that could not proceed. No addresses.
 * Public, so the state is whitelisted at runtime rather than trusted from the
 * type. Anything else is a silent no-op: a prober learns nothing either way.
 */
export const recordInviteBlocked = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; state: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const state = data?.state;
    if (typeof state !== "string" || !(INVITE_BLOCKED_STATES as readonly string[]).includes(state)) {
      return { ok: true };
    }
    const { recordInviteBlockedByCode } = await import("./invites.server");
    await recordInviteBlockedByCode(data.code ?? "", state);
    return { ok: true };
  });

type Input = {
  profile_id?: string | undefined;
  code: string;
  email: string;
  accept_url: string;
};

function validate(input: Input): Input {
  if (!input?.code) throw new Error("Missing invite code.");
  if (!input.email || !input.email.includes("@")) throw new Error("Enter a valid email address.");
  if (!/^https?:\/\//.test(input.accept_url ?? "")) throw new Error("Missing invite link.");
  return input;
}

/** Emails an existing invite. Falls back cleanly when Resend is not set up. */
export const sendInviteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<InviteEmailResult> => {
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { assertInviteInOrg, sendInviteViaResend } = await import("@/lib/invites.server");
    const { recordEvent } = await import("@/lib/telemetry.server");

    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile || (profile.role !== "admin" && profile.role !== "lead")) {
      throw new Response("Forbidden", { status: 403 });
    }
    await assertInviteInOrg(context.supabase, data.code, profile.org_id);

    const { data: me } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", profile.id)
      .maybeSingle();

    const result = await sendInviteViaResend({
      to: data.email.trim(),
      inviterName: me?.display_name || "Someone at your firm",
      acceptUrl: data.accept_url,
    });

    // Content-free: never the recipient address, only whether it went out.
    await recordEvent(context.supabase, {
      eventType: "invite.email_sent",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { delivered: result.sent, reason: result.reason },
    });

    return result;
  });

/**
 * Creating an invite is admission to the workspace, so it runs here rather than
 * from the browser. The admin check mirrors make_invite, which refuses anyone
 * else anyway; this way the refusal is typed, honest and recorded.
 */
export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { profile_id?: string | undefined; role: "coach" | "em"; email?: string | undefined }) =>
      input,
  )
  .handler(async ({ data, context }): Promise<CreateInviteResult> => {
    const { resolveProfile } = await import("@/lib/profile-resolve");
    const { recordEvent } = await import("@/lib/telemetry.server");

    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: row } = await context.supabase
      .from("profiles")
      .select("deactivated_at")
      .eq("id", profile.id)
      .maybeSingle();

    if (profile.role !== "admin" || row?.deactivated_at) {
      // Content free: the state only, never the address or the intended role.
      await recordEvent(context.supabase, {
        eventType: "invite.blocked",
        orgId: profile.org_id,
        userId: context.userId,
        dims: { state: "not_permitted" },
      });
      return { ok: false, reason: "not_permitted", message: INVITE_ADMIN_ONLY_LINE };
    }

    const email = (data.email ?? "").trim();
    const { data: code, error } = await context.supabase.rpc("make_invite", {
      p_role: data.role,
      p_org_id: profile.org_id,
      ...(email ? { p_email: email } : {}),
    });
    if (error || !code) throw new Error(error?.message ?? "Could not create an invite.");

    await recordEvent(context.supabase, {
      eventType: "coach.invite_created",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { role: data.role },
    });

    return { ok: true, code: String(code) };
  });
