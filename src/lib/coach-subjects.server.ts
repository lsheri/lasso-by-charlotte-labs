import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  COACH_SUBJECTS_SELECT,
  EMPTY_COACH_ACTIVITY,
  composeCoachSubjects,
  sortAcrossOrgs,
  type CoachActivity,
  type CoachEngagementRow,
  type CoachRoster,
  type CoachSubjectAcrossOrgs,
} from "@/lib/coach-subjects-shared";

type Db = SupabaseClient<Database>;

/**
 * One coach profile's queue: the roster read first, because everything else
 * depends on which engagements are shared, then the four dependent reads in
 * parallel. Every read runs on the caller's client, so row level policies
 * decide what comes back exactly as they did in the browser.
 */
export async function buildCoachQueue(
  supabase: Db,
  coachProfileId: string,
): Promise<{ roster: CoachRoster; activity: CoachActivity }> {
  const { data: coached, error: coachedError } = await supabase
    .from("engagement_members")
    .select(
      "engagement_id, engagements(id, code, title, client_label, clients(id, name, quick_folder))",
    )
    .eq("profile_id", coachProfileId)
    .eq("member_role", "coach");
  if (coachedError) throw new Error(coachedError.message);

  const engagements = ((coached ?? []) as unknown as CoachEngagementRow[]).filter(
    (row) => row.engagements !== null,
  );
  if (engagements.length === 0) {
    return { roster: { engagements: [], subjects: [] }, activity: EMPTY_COACH_ACTIVITY };
  }
  const engagementIds = engagements.map((row) => row.engagement_id);

  const [subjectsRes, notesRes, decisionsRes, linksRes] = await Promise.all([
    supabase
      .from("engagement_members")
      .select(COACH_SUBJECTS_SELECT)
      .in("engagement_id", engagementIds)
      .eq("member_role", "em"),
    supabase
      .from("coaching_notes")
      .select("subject_id, engagement_id, created_at")
      .eq("author_id", coachProfileId)
      .order("created_at", { ascending: false }),
    supabase
      .from("decisions")
      .select("owner_id, engagement_id, created_at")
      .eq("status", "confirmed")
      .in("engagement_id", engagementIds),
    supabase
      .from("work_item_tasks")
      .select("mapped_at, tasks!inner(engagement_id, owner_id)")
      .in("tasks.engagement_id", engagementIds),
  ]);
  if (subjectsRes.error) throw new Error(subjectsRes.error.message);

  return {
    roster: {
      engagements,
      subjects: (subjectsRes.data ?? []) as unknown as CoachRoster["subjects"],
    },
    activity: {
      notes: (notesRes.data ?? []) as CoachActivity["notes"],
      decisions: (decisionsRes.data ?? []) as CoachActivity["decisions"],
      mapped: (linksRes.data ?? []) as unknown as CoachActivity["mapped"],
    },
  };
}

/** The whole queue across every coach profile this person holds. */
export async function buildCoachSubjects(
  supabase: Db,
  coaches: { id: string; org_name: string }[],
): Promise<CoachSubjectAcrossOrgs[]> {
  const queues = await Promise.all(
    coaches.map(async (coach) => {
      const { roster, activity } = await buildCoachQueue(supabase, coach.id);
      return composeCoachSubjects(coach.id, roster, activity).map((subject) => ({
        ...subject,
        coach_profile_id: coach.id,
        org_name: coach.org_name,
      }));
    }),
  );
  return sortAcrossOrgs(queues.flat());
}
