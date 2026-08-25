import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  composeCoaches,
  composeMembership,
  computeStepOrder,
  type EngagementCoach,
  type EngagementPagePayload,
  type EngagementRow,
  type EngagementTask,
  type DecisionRow,
} from "@/lib/engagement-page-shared";

type Db = SupabaseClient<Database>;

const ENGAGEMENT_SELECT =
  "id, code, title, client_label, client_id, brief, brief_by, term_label, clients(id, name, quick_folder)";

const TASKS_SELECT =
  "id, name, owner_id, detail, work_item_tasks(step_no, step_confirmed, work_items(id, owner_id, title, type, source, visibility, captured_at, content_ref, created_at_source, work_date, content_fidelity, meta))";

const COACHES_SELECT =
  "profile_id, member_role, added_at, profiles!engagement_members_profile_id_fkey(id, display_name), added_by_profile:profiles!engagement_members_added_by_fkey(display_name)";

/**
 * The whole engagement page in one round trip. Every read runs on the caller's
 * own client, so row level policies decide exactly what comes back, the same
 * rows the browser used to fetch one query at a time.
 */
export async function buildEngagementPage(
  supabase: Db,
  engagementId: string,
  profileId: string,
): Promise<EngagementPagePayload> {
  const [engagementRes, tasksRes, coachesRes, membershipRes, decisionsRes] = await Promise.all([
    supabase.from("engagements").select(ENGAGEMENT_SELECT).eq("id", engagementId).maybeSingle(),
    supabase
      .from("tasks")
      .select(TASKS_SELECT)
      .eq("engagement_id", engagementId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("engagement_members")
      .select(COACHES_SELECT)
      .eq("engagement_id", engagementId)
      .eq("member_role", "coach"),
    supabase
      .from("engagement_members")
      .select("member_role")
      .eq("engagement_id", engagementId)
      .eq("profile_id", profileId),
    supabase
      .from("decisions")
      .select("*")
      .eq("engagement_id", engagementId)
      .in("status", ["draft", "confirmed"])
      .order("created_at", { ascending: true }),
  ]);

  if (engagementRes.error) throw new Error(engagementRes.error.message);
  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (membershipRes.error) throw new Error(membershipRes.error.message);

  const tasks = (tasksRes.data ?? []) as unknown as EngagementTask[];

  return {
    engagement: (engagementRes.data ?? null) as unknown as EngagementRow | null,
    tasks,
    coaches: composeCoaches(
      (coachesRes.data ?? []) as unknown as Parameters<typeof composeCoaches>[0],
    ) as EngagementCoach[],
    membership: composeMembership((membershipRes.data ?? []) as { member_role: string }[]),
    decisions: (decisionsRes.data ?? []) as DecisionRow[],
    stepOrder: computeStepOrder(tasks),
  };
}
