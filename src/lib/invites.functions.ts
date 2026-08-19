import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { InviteEmailResult } from "./invites-shared";
import type { BlockedState, InviteState } from "./invite-state";

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

/** Content-free record of an accept that could not proceed. No addresses. */
export const recordInviteBlocked = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; state: BlockedState }) => input)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { recordInviteBlockedByCode } = await import("./invites.server");
    await recordInviteBlockedByCode(data.code, data.state);
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
