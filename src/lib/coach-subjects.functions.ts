import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { CoachSubjectAcrossOrgs } from "./coach-subjects-shared";

type Input = { profile_ids: string[] };

/**
 * The coach queue in one round trip. Ownership of every named profile is
 * verified against the signed in user, and every read below runs on the
 * caller's own client, so nothing widens what row level policies already
 * allow this coach to see.
 */
export const getCoachSubjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => ({
    profile_ids: Array.from(new Set((input.profile_ids ?? []).filter(Boolean))).slice(0, 20),
  }))
  .handler(async ({ data, context }): Promise<CoachSubjectAcrossOrgs[]> => {
    if (data.profile_ids.length === 0) return [];
    const { supabase, userId } = context;

    const { resolveProfile } = await import("./profile-resolve");
    const resolved = await Promise.all(
      data.profile_ids.map((id) => resolveProfile(supabase, userId, id)),
    );
    const mine = resolved.filter(
      (profile): profile is NonNullable<typeof profile> =>
        profile !== null && profile.role === "coach",
    );
    if (mine.length === 0) return [];

    const orgIds = Array.from(new Set(mine.map((profile) => profile.org_id)));
    const { data: orgs } = await supabase.from("orgs").select("id, name").in("id", orgIds);
    const orgName = new Map((orgs ?? []).map((org) => [org.id, org.name]));

    const { buildCoachSubjects } = await import("./coach-subjects.server");
    return buildCoachSubjects(
      supabase,
      mine.map((profile) => ({
        id: profile.id,
        org_name: orgName.get(profile.org_id) ?? "",
      })),
    );
  });
