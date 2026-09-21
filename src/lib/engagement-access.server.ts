/**
 * S2: who is on this board, and the one call that changes it.
 *
 * Every rule about who may give what lives in set_engagement_person_access.
 * Nothing here writes to engagement_members, because no policy would allow it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  accessFromMemberRole,
  type EngagementAccessChoice,
  type EngagementAccessValue,
  type EngagementPeoplePayload,
  type EngagementPerson,
} from "@/lib/engagement-access-shared";
import type { ResolvedProfile } from "@/lib/profile-resolve";

type Db = SupabaseClient<Database>;

/** Everyone in the workspace, carrying what they have on this board today. */
export async function listEngagementPeople(
  db: Db,
  engagementId: string,
  profile: ResolvedProfile,
): Promise<EngagementPeoplePayload> {
  const { isEngagementEditor } = await import("@/lib/canvas-lab.server");
  const canShare = await isEngagementEditor(db, engagementId, profile.id);
  if (!canShare) return { people: [], canShare: false };

  const [peopleRes, memberRes] = await Promise.all([
    db
      .from("profiles")
      .select("id, display_name, deactivated_at")
      .eq("org_id", profile.org_id)
      .order("display_name", { ascending: true }),
    db.from("engagement_members").select("profile_id, member_role").eq("engagement_id", engagementId),
  ]);

  const roles = new Map<string, string>();
  for (const row of memberRes.data ?? []) roles.set(row.profile_id, row.member_role);

  const people: EngagementPerson[] = (peopleRes.data ?? [])
    .filter((row) => !row.deactivated_at)
    .map((row) => ({
      id: row.id,
      display_name: row.display_name ?? "",
      access: accessFromMemberRole(roles.get(row.id) ?? null),
      isYou: row.id === profile.id,
    }));

  return { people, canShare: true };
}

/** What this person has on this engagement right now, before anything changes. */
export async function currentAccess(
  db: Db,
  engagementId: string,
  personId: string,
): Promise<EngagementAccessChoice | null> {
  const { data } = await db
    .from("engagement_members")
    .select("member_role")
    .eq("engagement_id", engagementId)
    .eq("profile_id", personId)
    .maybeSingle();
  return accessFromMemberRole(data?.member_role ?? null);
}

export type AccessCallOutcome =
  | { status: "done"; returned: string; previous: EngagementAccessChoice | null }
  | { status: "refused" };

/** One call, straight through to the database function. */
export async function setPersonAccess(
  db: Db,
  engagementId: string,
  personId: string,
  access: EngagementAccessValue,
): Promise<AccessCallOutcome> {
  const previous = await currentAccess(db, engagementId, personId);
  const { data, error } = await db.rpc("set_engagement_person_access", {
    p_engagement: engagementId,
    p_profile: personId,
    p_access: access,
  });
  if (error || typeof data !== "string") return { status: "refused" };
  return { status: "done", returned: data, previous };
}
