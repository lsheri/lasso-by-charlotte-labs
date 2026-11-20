import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { resolveProfile, type ResolvedProfile } from "./profile-resolve";
import type { TelemetryEvent } from "./telemetry-shared";
import { isFirmWorkspace } from "./org-type";

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
 * Resend mints a fresh invite first, then withdraws the old one. That order
 * matters: if minting fails the recipient still holds a working link.
 */
export async function resendInviteByCode(
  context: AuthedContext,
  profileId: string | null | undefined,
  code: string,
): Promise<{ code: string; delivered: boolean; reason: string; old_revoked: boolean }> {
  const { profile, supabaseAdmin } = await requireConsoleAccess(
    context.supabase,
    context.userId,
    profileId,
  );

  const { data: invite, error: readError } = await supabaseAdmin
    .from("invites")
    .select("code, org_id, invited_role, email, used_by, revoked_at")
    .eq("code", code)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!invite || invite.org_id !== profile.org_id) throw new Error("Invite not found");
  if (invite.used_by) throw new Error("Invite already used");
  if (invite.revoked_at) throw new Error("Invite already withdrawn");

  const { data: minted, error: mintError } = await context.supabase.rpc("make_invite", {
    p_role: invite.invited_role,
    p_org_id: profile.org_id,
    ...(invite.email ? { p_email: invite.email } : {}),
  });
  if (mintError || !minted) throw new Error(mintError?.message ?? "Could not create a new invite.");

  // Minting first is deliberate. If the withdraw leg fails the new link still
  // works, so we report the old one as live rather than throwing after a mint.
  let oldRevoked = true;
  try {
    await revokeInviteByCode(context, profileId, code, "resend");
  } catch {
    oldRevoked = false;
  }

  let delivered = false;
  let reason = "no_email";
  const { inviteEmailVariant } = await import("./invites-shared");
  let variant: ReturnType<typeof inviteEmailVariant> = "standard";
  if (invite.email) {
    const [{ data: me }, { data: org }] = await Promise.all([
      context.supabase.from("profiles").select("display_name").eq("id", profile.id).maybeSingle(),
      context.supabase.from("orgs").select("name, settings").eq("id", profile.org_id).maybeSingle(),
    ]);
    const orgType =
      isFirmWorkspace(((org?.settings ?? {}) as Record<string, unknown>)["type"])
        ? ("business" as const)
        : ("personal" as const);
    variant = inviteEmailVariant(invite.invited_role, orgType);
    const { sendInviteEmail } = await import("./invites.server");
    const result = await sendInviteEmail({
      to: invite.email,
      inviterName: me?.display_name || "Someone at your firm",
      code: minted as string,
      orgName: org?.name ?? undefined,
      role: invite.invited_role,
      orgType,
    });
    delivered = result.sent;
    reason = result.reason;
  }

  const { recordEvent } = await import("./telemetry.server");
  await recordEvent(supabaseAdmin, {
    eventType: "invite.email_sent",
    orgId: profile.org_id,
    userId: context.userId,
    dims: { delivered, reason, resend: true, variant },
  });

  return { code: minted as string, delivered, reason, old_revoked: oldRevoked };
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
  reason: "manual" | "resend" = "manual",
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
    dims: { reason },
  });
  return { ok: true };
}

/**
 * 20 Nov 2026, chat pill build Phase 2: an admin changes a teammate's role between Admin, Lead and Member. The rules
 * are roleChangeRefusal (member-roles-shared.ts), run here on the server with fresh reads. The write goes through the
 * service role only after they pass, scoped to the workspace and to the role the rules saw, so a change made
 * meanwhile by someone else is not overwritten. Demoting an admin is checked again after the write: if two admins
 * demoted each other at once and none is left, this one is put back.
 */
export type RoleChangeDeps = {
  caller: () => Promise<{ profileId: string; orgId: string; role: string; active: boolean } | null>;
  target: (orgId: string, id: string) => Promise<{ id: string; orgId: string; role: string; active: boolean; isGuest: boolean } | null>;
  workspace: (orgId: string) => Promise<{ firmView: boolean; showsAdmin: boolean } | null>;
  activeAdmins: (orgId: string) => Promise<number | null>;
  /** Writes the new role only if the row still has the old one; true when exactly one row changed. */
  write: (orgId: string, id: string, from: string, to: string) => Promise<boolean>;
  record: (orgId: string, from: string, to: string) => Promise<void>;
};

export async function changeMemberRole(
  deps: RoleChangeDeps,
  input: { member_id: string; role: string },
): Promise<import("./member-roles-shared").RoleChangeResult> {
  const { roleChangeRefusal } = await import("./member-roles-shared");
  const caller = await deps.caller();
  if (!caller) throw new Response("Forbidden", { status: 403 });
  try {
    const [target, workspace, admins] = await Promise.all([
      deps.target(caller.orgId, input.member_id),
      deps.workspace(caller.orgId),
      deps.activeAdmins(caller.orgId),
    ]);
    if (!workspace || admins === null) return { ok: false, reason: "unavailable" };
    const refusal = roleChangeRefusal({ caller, target, next: input.role, workspace, activeAdmins: admins });
    if (refusal) return { ok: false, reason: refusal };
    const from = target!.role;
    const to = input.role as import("./member-roles-shared").MemberRole;
    if (!(await deps.write(caller.orgId, target!.id, from, to))) return { ok: false, reason: "unavailable" };
    if (from === "admin") {
      const left = await deps.activeAdmins(caller.orgId);
      if (left === null || left < 1) {
        // Put back. If even that fails, say so plainly (QA of PR 288, L1): never claim the admin is still there.
        const restored = await deps.write(caller.orgId, target!.id, to, "admin").catch(() => false);
        if (!restored) {
          console.error("[members] role change left no admin and could not be put back", { org: caller.orgId });
          return { ok: false, reason: "no_admin_left" };
        }
        return { ok: false, reason: "last_admin" };
      }
    }
    await deps.record(caller.orgId, from, to).catch(() => undefined);
    return { ok: true, role: to };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function realRoleChangeDeps(context: AuthedContext, profileId: string | null | undefined): Promise<RoleChangeDeps> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as SupabaseClient<Database>;
  return {
    async caller() {
      const profile = await resolveProfile(context.supabase, context.userId, profileId);
      if (!profile) return null;
      const { data } = await admin.from("profiles").select("deactivated_at").eq("id", profile.id).maybeSingle();
      return { profileId: profile.id, orgId: profile.org_id, role: profile.role, active: !data?.deactivated_at };
    },
    async target(orgId, id) {
      const { data, error } = await admin.from("profiles").select("id, org_id, role, deactivated_at, is_guest").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (error) throw new Error("unreadable");
      return data ? { id: data.id, orgId: data.org_id, role: data.role, active: !data.deactivated_at, isGuest: Boolean(data.is_guest) } : null;
    },
    async workspace(orgId) {
      const { data } = await admin.from("orgs").select("has_firm_view, shows_admin_role").eq("id", orgId).maybeSingle();
      return data ? { firmView: data.has_firm_view === true, showsAdmin: data.shows_admin_role === true } : null;
    },
    async activeAdmins(orgId) {
      const { count, error } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("role", "admin")
        .is("deactivated_at", null)
        .eq("is_guest", false);
      return error ? null : (count ?? 0);
    },
    async write(orgId, id, from, to) {
      const { data, error } = await admin
        .from("profiles")
        .update({ role: to as Database["public"]["Enums"]["app_role"] })
        .eq("id", id)
        .eq("org_id", orgId)
        .eq("role", from as Database["public"]["Enums"]["app_role"])
        .select("id");
      return !error && (data ?? []).length === 1;
    },
    async record(orgId, from, to) {
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(context.supabase, { eventType: "member.role_changed", orgId, userId: context.userId, dims: { from, to } });
    },
  };
}
