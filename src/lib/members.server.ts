import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { resolveProfile, type ResolvedProfile } from "./profile-resolve";
import type { TelemetryEvent } from "./telemetry-shared";

type AuthedContext = { supabase: SupabaseClient<Database>; userId: string };

/** The console is admin/lead only. Leads read; admins act (the RPCs enforce that). */
export async function requireConsoleAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  profileId?: string | null | undefined,
): Promise<{ profile: ResolvedProfile; supabaseAdmin: SupabaseClient<Database> }> {
  const profile = await resolveProfile(supabase, userId, profileId);
  if (!profile || (profile.role !== "admin" && profile.role !== "lead")) {
    throw new Response("Forbidden", { status: 403 });
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { profile, supabaseAdmin: supabaseAdmin as unknown as SupabaseClient<Database> };
}

/**
 * The RPCs own every authorization rule (admin check, last-admin guard, no
 * self-deactivation). We only resolve the acting profile, call, and record a
 * content-free event.
 */
export async function callMemberRpc(
  context: AuthedContext,
  profileId: string | null | undefined,
  eventType: TelemetryEvent,
  call: (supabase: SupabaseClient<Database>) => PromiseLike<{ error: { message: string } | null }>,
): Promise<{ ok: true }> {
  const profile = await resolveProfile(context.supabase, context.userId, profileId);
  if (!profile) throw new Response("Forbidden", { status: 403 });

  const { error } = await call(context.supabase);
  if (error) throw new Error(error.message);

  const { recordEvent } = await import("./telemetry.server");
  await recordEvent(context.supabase, {
    eventType,
    orgId: profile.org_id,
    userId: context.userId,
    dims: {},
  });
  return { ok: true };
}

/**
 * revoke_invite(p_invite uuid) cannot be used: public.invites has no id column
 * (its primary key is `code`), so the RPC resolves no row. Until the schema and
 * the RPC agree, we revoke by code under an explicit admin/lead check.
 */
export async function revokeInviteByCode(
  context: AuthedContext,
  profileId: string | null | undefined,
  code: string,
): Promise<{ ok: true }> {
  const { profile, supabaseAdmin } = await requireConsoleAccess(
    context.supabase,
    context.userId,
    profileId,
  );

  const { data: invite, error: readError } = await supabaseAdmin
    .from("invites")
    .select("code, org_id, used_by, revoked_at")
    .eq("code", code)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!invite || invite.org_id !== profile.org_id) throw new Error("Invite not found");
  if (invite.used_by) throw new Error("Invite already used");

  const { error } = await supabaseAdmin
    .from("invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("code", code)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);

  const { recordEvent } = await import("./telemetry.server");
  await recordEvent(supabaseAdmin, {
    eventType: "invite.revoked",
    orgId: profile.org_id,
    userId: context.userId,
    dims: {},
  });
  return { ok: true };
}
