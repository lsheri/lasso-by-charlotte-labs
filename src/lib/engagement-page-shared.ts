import type { Database } from "@/integrations/supabase/types";
import type { WorkItemRow } from "@/lib/work-types";

export type EngagementRow = {
  id: string;
  code: string;
  title: string;
  client_label: string | null;
  client_id: string | null;
  clients: { id: string; name: string; quick_folder: boolean } | null;
  brief: string | null;
  brief_by: string | null;
  term_label: string | null;
};

export type EngagementTaskLink = {
  step_no: number | null;
  step_confirmed: boolean;
  work_items: (WorkItemRow & { owner_id?: string | null }) | null;
};

export type EngagementTask = {
  id: string;
  name: string;
  owner_id: string;
  detail: string | null;
  work_item_tasks: EngagementTaskLink[];
};

export type EngagementCoach = {
  id: string;
  display_name: string;
  added_at: string | null;
  added_by_name: string | null;
};

export type EngagementMembership = { isMember: boolean; isCoachMember: boolean };

export type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];

/** One page load: everything the engagement page reads, in one payload. */
export type EngagementPagePayload = {
  engagement: EngagementRow | null;
  tasks: EngagementTask[];
  coaches: EngagementCoach[];
  membership: EngagementMembership;
  decisions: DecisionRow[];
  /** work_item_id to sequence rank, lowest first. */
  stepOrder: Record<string, number>;
};

export const EMPTY_ENGAGEMENT_PAGE: EngagementPagePayload = {
  engagement: null,
  tasks: [],
  coaches: [],
  membership: { isMember: false, isCoachMember: false },
  decisions: [],
  stepOrder: {},
};

/**
 * A decision sits where its earliest cited item sits in the workflow. Tasks
 * arrive already ordered by position, so the array index stands in for that
 * position and the comparison order is identical to reading it from the row.
 */
export function computeStepOrder(tasks: EngagementTask[]): Record<string, number> {
  const order: Record<string, number> = {};
  tasks.forEach((task, index) => {
    for (const link of task.work_item_tasks ?? []) {
      const itemId = link.work_items?.id;
      if (!itemId) continue;
      const rank = index * 1000 + (link.step_no ?? 999);
      const current = order[itemId];
      if (current === undefined || rank < current) order[itemId] = rank;
    }
  });
  return order;
}

/** Coaches are worked out from the membership rows, the sharer named where known. */
export function composeCoaches(
  rows: {
    added_at: string | null;
    profiles: { id: string; display_name: string } | null;
    added_by_profile: { display_name: string } | null;
  }[],
): EngagementCoach[] {
  return rows
    .filter((row) => row.profiles !== null)
    .map((row) => ({
      id: row.profiles!.id,
      display_name: row.profiles!.display_name,
      added_at: row.added_at,
      added_by_name: row.added_by_profile?.display_name ?? null,
    }));
}

/** Membership is read for the caller's own profile only, never inferred from role. */
export function composeMembership(rows: { member_role: string }[]): EngagementMembership {
  return {
    isMember: rows.some((row) => row.member_role !== "coach"),
    isCoachMember: rows.some((row) => row.member_role === "coach"),
  };
}
