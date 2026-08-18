import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OnboardingRoleVariant = "worker" | "coach";

export type OnboardingProgress = {
  role_variant: OnboardingRoleVariant;
  is_admin: boolean;
  quick_folder: boolean;
  counts: {
    capture: number;
    work_items: number;
    mapped: number;
    analyses: number;
    invites: number;
    shared_engagements: number;
    firm_checks: number;
    one_on_one: number;
    members: number;
  };
  naming_set: boolean;
};

/**
 * One aggregated read for the getting started checklist. Every step is
 * computed from the real record, so nothing here is stored progress: these
 * are head-only counts on owner scoped, already indexed tables, gathered in
 * a single round trip from the browser's point of view.
 *
 * The caller is always the signed in user. There is no profile id argument
 * on purpose, so no one can read another person's onboarding position.
 */
export const getOnboardingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined }) => input)
  .handler(async ({ data, context }): Promise<OnboardingProgress | null> => {
    const { resolveProfile } = await import("./profile-resolve");
    const supabase = context.supabase;
    const profile = await resolveProfile(supabase, context.userId, data.profile_id);
    if (!profile) return null;

    const head = { count: "exact" as const, head: true };
    const isCoach = profile.role === "coach";

    const [
      tokens,
      connectors,
      workItems,
      mapped,
      analyses,
      invites,
      sharedEngagements,
      firmChecks,
      oneOnOne,
      members,
      adminRole,
      org,
    ] = await Promise.all([
      supabase
        .from("mcp_tokens")
        .select("id", head)
        .eq("profile_id", profile.id)
        .is("revoked_at", null),
      supabase
        .from("connector_accounts")
        .select("id", head)
        .eq("profile_id", profile.id)
        .eq("status", "connected"),
      supabase.from("work_items").select("id", head).eq("owner_id", profile.id),
      supabase
        .from("work_items")
        .select("id", head)
        .eq("owner_id", profile.id)
        .eq("visibility", "mapped"),
      supabase
        .from("analysis_runs")
        .select("id", head)
        .eq(isCoach ? "run_by_profile_id" : "owner_id", profile.id),
      supabase.from("invites").select("code", head).eq("org_id", profile.org_id),
      supabase
        .from("engagement_members")
        .select("engagement_id", head)
        .eq("profile_id", profile.id),
      supabase.from("firm_checks").select("id", head).eq("author_profile_id", profile.id),
      supabase.from("one_on_one_notes").select("id", head).eq("owner_id", profile.id),
      supabase.from("profiles").select("id", head).eq("org_id", profile.org_id),
      supabase.rpc("has_org_role", { p_org: profile.org_id, p_roles: ["lead", "admin"] }),
      supabase.from("orgs").select("settings").eq("id", profile.org_id).maybeSingle(),
    ]);

    const settings = (org.data?.settings ?? {}) as Record<string, unknown>;

    return {
      role_variant: isCoach ? "coach" : "worker",
      is_admin: adminRole.data === true,
      quick_folder: settings["type"] === "personal",
      counts: {
        capture: (tokens.count ?? 0) + (connectors.count ?? 0),
        work_items: workItems.count ?? 0,
        mapped: mapped.count ?? 0,
        analyses: analyses.count ?? 0,
        invites: invites.count ?? 0,
        shared_engagements: sharedEngagements.count ?? 0,
        firm_checks: firmChecks.count ?? 0,
        one_on_one: oneOnOne.count ?? 0,
        members: members.count ?? 0,
      },
      naming_set: String(settings["naming_conventions"] ?? "").trim().length > 0,
    };
  });
