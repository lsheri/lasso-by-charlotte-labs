import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { TelemetryDims, TelemetryEvent } from "./telemetry-shared";

export const recordEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      event_type: TelemetryEvent;
      org_id: string;
      dims?: TelemetryDims;
      session_id?: string | undefined;
      client_seq?: number | undefined;
      profile_id?: string | undefined;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    let dims = data.dims ?? {};
    const { guardWorkboardEvent, isWorkboardEvent } = await import("./workboard-event-allowlist");
    if (isWorkboardEvent(data.event_type)) {
      const verdict = guardWorkboardEvent(data.event_type, dims);
      if (!verdict.keep) return { ok: true };
      dims = verdict.dims;
    } else {
      const { guardEventDims } = await import("./event-dim-allowlist");
      dims = guardEventDims(data.event_type, dims).dims;
    }
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id).catch(
      () => null,
    );
    const { recordEvent, notePresence } = await import("./telemetry.server");
    await recordEvent(context.supabase, {
      eventType: data.event_type,
      orgId: data.org_id,
      userId: context.userId,
      dims,
      profileId: profile?.id ?? null,
      sessionId: data.session_id ?? null,
      clientSeq: data.client_seq ?? null,
    });

    if (profile) {
      await notePresence(context.supabase, {
        orgId: profile.org_id,
        profileId: profile.id,
        userId: context.userId,
      });
    }
    return { ok: true };
  });

/**
 * Marketing pages are seen by people with no session at all, so this path has
 * no auth middleware. It accepts only content-free dims and a random view id.
 */
export const recordAnonymousEventFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      event_type: TelemetryEvent;
      view_id: string;
      dims?: TelemetryDims;
      visitor_id?: string | undefined;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { recordAnonymousEvent } = await import("./telemetry.server");
    const visitorId =
      typeof data.visitor_id === "string" && data.visitor_id.length > 0
        ? data.visitor_id.slice(0, 128)
        : undefined;
    await recordAnonymousEvent(
      data.event_type,
      String(data.view_id).slice(0, 64),
      data.dims ?? {},
      visitorId,
    );
    return { ok: true };
  });

/** Accounts older than this are sign-ins, not sign-ups: no alias. */
const SIGNUP_ALIAS_WINDOW_MS = 15 * 60 * 1000;

/**
 * Unit D7: alias the anonymous funnel identity to the new account, once, at
 * sign-up. No session exists yet when email confirmation is on, so the user id
 * is checked server side: it must be a real account created in the last
 * fifteen minutes. Never throws into the sign-up path.
 */
export const aliasSignupVisitorFn = createServerFn({ method: "POST" })
  .inputValidator((input: { user_id: string; visitor_id: string }) => input)
  .handler(async ({ data }) => {
    try {
      const userId = typeof data.user_id === "string" ? data.user_id.slice(0, 64) : "";
      const visitorId =
        typeof data.visitor_id === "string" ? data.visitor_id.slice(0, 128) : "";
      if (!userId || !visitorId) return { ok: false };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: found, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (error || !found?.user?.created_at) return { ok: false };
      if (Date.now() - new Date(found.user.created_at).getTime() > SIGNUP_ALIAS_WINDOW_MS) {
        return { ok: false };
      }
      const { aliasAnonymousVisitor } = await import("./telemetry.server");
      return { ok: await aliasAnonymousVisitor(visitorId, userId) };
    } catch {
      return { ok: false };
    }
  });
