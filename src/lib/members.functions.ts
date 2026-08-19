import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { MembersPayload } from "./members-shared";

type Ctx = { profile_id?: string | undefined };

export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Ctx) => input)
  .handler(async ({ data, context }): Promise<MembersPayload> => {
    const { requireConsoleAccess } = await import("./members.server");
    const { profile, supabaseAdmin } = await requireConsoleAccess(
      context.supabase,
      context.userId,
      data.profile_id,
    );

    const [{ data: profiles, error }, { data: invites }, { data: entitlement }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, user_id, display_name, role, created_at, deactivated_at")
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("invites")
        .select("code, invited_role, email, expires_at, used_at, revoked_at, created_by")
        .eq("org_id", profile.org_id)
        .order("expires_at", { ascending: false })
        .limit(50),
      // Admin client, so the org filter is the only thing standing between
      // this read and another workspace's plan. It is mandatory.
      supabaseAdmin
        .from("entitlements")
        .select("plan, source, status, seats, guest_seats_counted, ends_at")
        .eq("org_id", profile.org_id)
        .eq("status", "active")
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);

    const active = (profiles ?? []).filter((row) => !row.deactivated_at);
    const seatsUsed = active.filter((row) => row.role !== "coach").length;
    const coaches = active.filter((row) => row.role === "coach").length;

    const emails = new Map<string, string>();
    try {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const user of users?.users ?? []) if (user.email) emails.set(user.id, user.email);
    } catch {
      /* emails are a convenience, the console still works without them */
    }

    return {
      viewer_role: profile.role,
      entitlement: entitlement
        ? {
            plan: entitlement.plan,
            source: entitlement.source,
            status: entitlement.status,
            seats: entitlement.seats,
            seats_used: seatsUsed,
            guest_seats_counted: entitlement.guest_seats_counted,
            ends_at: entitlement.ends_at,
            coaches,
          }
        : null,
      members: (profiles ?? []).map((row) => ({
        id: row.id,
        display_name: row.display_name,
        email: row.user_id ? (emails.get(row.user_id) ?? null) : null,
        role: row.role,
        created_at: row.created_at,
        deactivated_at: row.deactivated_at,
      })),
      invites: (invites ?? []).map((row) => ({
        id: row.code,
        code: row.code,
        invited_role: row.invited_role,
        email: row.email,
        expires_at: row.expires_at,
        used_at: row.used_at,
        revoked_at: row.revoked_at,
        created_by_name: row.created_by
          ? ((profiles ?? []).find((p) => p.id === row.created_by)?.display_name ?? null)
          : null,
      })),
    };
  });

export const deactivateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Ctx & { member_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { callMemberRpc } = await import("./members.server");
    return callMemberRpc(context, data.profile_id, "member.deactivated", (supabase) =>
      supabase.rpc("deactivate_member", { p_profile: data.member_id }),
    );
  });

export const reactivateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Ctx & { member_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { callMemberRpc } = await import("./members.server");
    return callMemberRpc(context, data.profile_id, "member.reactivated", (supabase) =>
      supabase.rpc("reactivate_member", { p_profile: data.member_id }),
    );
  });

export const changeMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Ctx & { member_id: string; role: "em" | "lead" }) => input)
  .handler(async ({ data, context }) => {
    const { callMemberRpc } = await import("./members.server");
    return callMemberRpc(context, data.profile_id, "member.role_changed", (supabase) =>
      supabase.rpc("set_member_role", { p_profile: data.member_id, p_role: data.role }),
    );
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Ctx & { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { revokeInviteByCode } = await import("./members.server");
    return revokeInviteByCode(context, data.profile_id, data.code);
  });

/** Mints a replacement invite, withdraws the old one, and emails when it can. */
export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Ctx & { code: string; origin: string }) => {
    if (!/^https?:\/\//.test(input.origin ?? "")) throw new Error("Missing invite link origin.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { resendInviteByCode } = await import("./members.server");
    return resendInviteByCode(context, data.profile_id, data.code, data.origin.replace(/\/$/, ""));
  });
