import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/use-profile";
import type { WorkItemRow } from "@/lib/work-types";
import { getCoachSubjects } from "@/lib/coach-subjects.functions";
import type { CoachSubjectAcrossOrgs } from "@/lib/coach-subjects-shared";

export type { CoachSubject, CoachSubjectAcrossOrgs } from "@/lib/coach-subjects-shared";

/**
 * engagement_members has two foreign keys to profiles (profile_id and
 * added_by), so every embed must name the relationship. This pins the
 * subject side; the sharer side uses engagement_members_added_by_fkey.
 */
export const COACH_SUBJECTS_SELECT =
  "engagement_id, profile_id, profiles!engagement_members_profile_id_fkey(id, display_name)";

/**
 * A coach sitting on their own page should see a new share without having to
 * touch anything. A one minute refresh of their own shared list is enough at
 * human tempo, and a hidden tab refreshes nothing at all.
 */
export const COACH_POLL = {
  refetchOnWindowFocus: true,
  refetchOnMount: "always",
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
} as const;

/**
 * One key for the whole queue, keeping the "coach-subjects" prefix so every
 * existing invalidation call site still reaches it.
 */
export function coachSubjectsKey(profileIdsCsv: string) {
  return ["coach-subjects", profileIdsCsv] as const;
}

/**
 * A coach may hold profiles in several orgs; the queue spans all of them and
 * arrives composed from the server in a single round trip, so the page paints
 * once with the counts already in place.
 */
export function useAllCoachSubjects(profiles: Profile[]) {
  const coachProfileIds = profiles.filter((p) => p.role === "coach").map((p) => p.id);
  const csv = coachProfileIds.join(",");
  const fetchSubjects = useServerFn(getCoachSubjects);

  const query = useQuery({
    queryKey: coachSubjectsKey(csv),
    enabled: coachProfileIds.length > 0,
    queryFn: (): Promise<CoachSubjectAcrossOrgs[]> =>
      fetchSubjects({ data: { profile_ids: coachProfileIds } }),
    ...COACH_POLL,
  });

  return {
    data: query.data ?? [],
    isLoading: coachProfileIds.length > 0 && query.isLoading,
    error: (query.error ?? null) as Error | null,
  };
}

export type PacketElement = {
  step_no: number | null;
  step_confirmed: boolean;
  mapped_at: string;
  work_items: (WorkItemRow & { owner_id?: string | null }) | null;
};

export type PacketTask = {
  id: string;
  name: string;
  goal: string | null;
  when_label: string | null;
  work_item_tasks: PacketElement[];
};

export type PacketNote = {
  id: string;
  created_at: string;
  did_well: string;
  would_try: string;
  watch_next: string;
  author_id: string;
};

export type Packet = {
  engagement: {
    id: string;
    code: string;
    title: string;
    client_label: string | null;
    brief: string | null;
    term_label: string | null;
    clients: { id: string; name: string; quick_folder: boolean } | null;
  } | null;
  subject: { id: string; display_name: string; title_band: string | null } | null;
  tasks: PacketTask[];
  decisions: {
    id: string;
    situation: string;
    call_text: string;
    why: string;
    date_label: string | null;
    created_at: string;
    srcs: unknown;
  }[];
  notes: PacketNote[];
};

export async function fetchPacket(engagementId: string, subjectId: string): Promise<Packet> {
  const [engagementRes, subjectRes, tasksRes, decisionsRes, notesRes] = await Promise.all([
    supabase
      .from("engagements")
      .select("id, code, title, client_label, brief, term_label, clients(id, name, quick_folder)")
      .eq("id", engagementId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, display_name, title_band")
      .eq("id", subjectId)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select(
        "id, name, goal, when_label, position, work_item_tasks(step_no, step_confirmed, mapped_at, work_items(id, owner_id, title, type, source, visibility, content_ref, content_fidelity, source_vendor, work_date, created_at_source, captured_at, meta))",
      )
      .eq("engagement_id", engagementId)
      .eq("owner_id", subjectId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("decisions")
      .select("id, situation, call_text, why, date_label, created_at, srcs")
      .eq("engagement_id", engagementId)
      .eq("owner_id", subjectId)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false }),
    supabase
      .from("coaching_notes")
      .select("id, created_at, did_well, would_try, watch_next, author_id")
      .eq("engagement_id", engagementId)
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false }),
  ]);

  if (engagementRes.error) throw engagementRes.error;
  if (tasksRes.error) throw tasksRes.error;

  const tasks = (tasksRes.data ?? []) as unknown as PacketTask[];

  return {
    engagement: engagementRes.data,
    subject: subjectRes.data,
    tasks,
    decisions: decisionsRes.data ?? [],
    notes: (notesRes.data ?? []) as PacketNote[],
  };
}

export function usePacket(engagementId: string, subjectId: string) {
  return useQuery({
    queryKey: ["packet", engagementId, subjectId],
    queryFn: () => fetchPacket(engagementId, subjectId),
  });
}
