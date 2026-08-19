import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OnboardingRoleVariant = "worker" | "coach";

export type OnboardingProgress = {
  role_variant: OnboardingRoleVariant;
  /** Console access: admin or lead. Reading the member list, not admission. */
  is_admin: boolean;
  /** Minting an invite is admin only, so the invite steps hang off this. */
  can_invite: boolean;
  quick_folder: boolean;
  counts: {
    capture: number;
    work_items: number;
    mapped: number;
    analyses: number;
    invites: number;
    /** Invites this person created, not the whole workspace's. */
    invites_by_me: number;
    shared_engagements: number;
    /** Engagements this person works on and has shared with a coach. */
    shared_by_me: number;
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
    const { sharedByMeCount } = await import("./coach-share-shared");
    const supabase = context.supabase;
    const profile = await resolveProfile(supabase, context.userId, data.profile_id);
    if (!profile) return null;

    const head = { count: "exact" as const, head: true };
    const isCoach = profile.role === "coach";

    /**
     * Engagements this person works on that carry a coach membership. Two
     * scoped head reads, then a distinct count in memory. No schema.
     */
    const sharedByMe = (async (): Promise<number> => {
      const mine = await supabase
        .from("engagement_members")
        .select("engagement_id")
        .eq("profile_id", profile.id)
        .neq("member_role", "coach");
      const ids = (mine.data ?? []).map((row) => row.engagement_id);
      if (ids.length === 0) return 0;
      const theirs = await supabase
        .from("engagement_members")
        .select("engagement_id")
        .eq("member_role", "coach")
        .in("engagement_id", ids);
      return sharedByMeCount(ids, theirs.data ?? []);
    })();

    const [
      tokens,
      connectors,
      workItems,
      mapped,
      analyses,
      invites,
      invitesByMe,
      sharedByMeTotal,
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
        .from("invites")
        .select("code", head)
        .eq("org_id", profile.org_id)
        .eq("created_by", profile.id),
      sharedByMe,
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
      can_invite: profile.role === "admin",
      quick_folder: settings["type"] === "personal",
      counts: {
        capture: (tokens.count ?? 0) + (connectors.count ?? 0),
        work_items: workItems.count ?? 0,
        mapped: mapped.count ?? 0,
        analyses: analyses.count ?? 0,
        invites: invites.count ?? 0,
        invites_by_me: invitesByMe.count ?? 0,
        shared_engagements: sharedEngagements.count ?? 0,
        shared_by_me: sharedByMeTotal,
        firm_checks: firmChecks.count ?? 0,
        one_on_one: oneOnOne.count ?? 0,
        members: members.count ?? 0,
      },
      naming_set: String(settings["naming_conventions"] ?? "").trim().length > 0,
    };
  });
