import { useQueries, useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/use-profile";
import type { WorkItemRow } from "@/lib/work-types";
import { engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";

export type CoachSubject = {
  engagement_id: string;
  engagement_code: string;
  engagement_title: string;
  subject_id: string;
  subject_name: string;
  last_note_at: string | null;
  total_decisions: number;
  total_elements: number;
  new_decisions: number;
  new_elements: number;
  last_activity: string | null;
};

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

/** The counts move far more slowly than the roster, so they are cached longer. */
export const COACH_ACTIVITY_STALE_TIME = 5 * 60_000;

type CoachEngagementRow = {
  engagement_id: string;
  engagements: {
    id: string;
    code: string;
    title: string;
    client_label: string | null;
    clients: { id: string; name: string; quick_folder: boolean } | null;
  } | null;
};

export type CoachRoster = {
  engagements: CoachEngagementRow[];
  subjects: {
    engagement_id: string;
    profile_id: string;
    profiles: { id: string; display_name: string } | null;
  }[];
};

export type CoachActivity = {
  notes: { subject_id: string; engagement_id: string | null; created_at: string }[];
  decisions: { owner_id: string; engagement_id: string | null; created_at: string }[];
  mapped: { mapped_at: string; tasks: { engagement_id: string; owner_id: string } | null }[];
};

export const EMPTY_COACH_ACTIVITY: CoachActivity = { notes: [], decisions: [], mapped: [] };

/** Who this profile coaches. Small and cheap, so this is the read that polls. */
export async function fetchCoachRoster(coachProfileId: string): Promise<CoachRoster> {
  const { data: coached, error: coachedError } = await supabase
    .from("engagement_members")
    .select(
      "engagement_id, engagements(id, code, title, client_label, clients(id, name, quick_folder))",
    )
    .eq("profile_id", coachProfileId)
    .eq("member_role", "coach");
  if (coachedError) throw coachedError;

  const engagements = ((coached ?? []) as unknown as CoachEngagementRow[]).filter(
    (row) => row.engagements !== null,
  );
  if (engagements.length === 0) return { engagements: [], subjects: [] };

  const engagementIds = engagements.map((row) => row.engagement_id);

  const { data: subjects, error: subjectsError } = await supabase
    .from("engagement_members")
    .select(COACH_SUBJECTS_SELECT)
    .in("engagement_id", engagementIds)
    .eq("member_role", "em");
  if (subjectsError) throw subjectsError;

  return { engagements, subjects: (subjects ?? []) as unknown as CoachRoster["subjects"] };
}

/** The counts behind each row. Slower moving, so these are cached for longer. */
export async function fetchCoachActivity(
  coachProfileId: string,
  engagementIds: string[],
): Promise<CoachActivity> {
  if (engagementIds.length === 0) return EMPTY_COACH_ACTIVITY;

  const { data: notes } = await supabase
    .from("coaching_notes")
    .select("subject_id, engagement_id, created_at")
    .eq("author_id", coachProfileId)
    .order("created_at", { ascending: false });

  const { data: decisions } = await supabase
    .from("decisions")
    .select("owner_id, engagement_id, created_at")
    .eq("status", "confirmed")
    .in("engagement_id", engagementIds);

  const { data: links } = await supabase
    .from("work_item_tasks")
    .select("mapped_at, tasks!inner(engagement_id, owner_id)")
    .in("tasks.engagement_id", engagementIds);

  return {
    notes: (notes ?? []) as CoachActivity["notes"],
    decisions: (decisions ?? []) as CoachActivity["decisions"],
    mapped: (links ?? []) as unknown as CoachActivity["mapped"],
  };
}

/** Pure join of the two reads, so neither query has to know about the other. */
export function composeCoachSubjects(
  coachProfileId: string,
  roster: CoachRoster,
  activity: CoachActivity,
): CoachSubject[] {
  const { engagements, subjects } = roster;
  const lastNote = new Map<string, string>();
  for (const note of activity.notes) {
    const key = `${note.engagement_id ?? ""}:${note.subject_id}`;
    if (!lastNote.has(key)) lastNote.set(key, note.created_at);
  }
  const decisions = activity.decisions;
  const mapped = activity.mapped;

  const rows: CoachSubject[] = subjects
    .filter((row) => row.profiles !== null && row.profile_id !== coachProfileId)
    .map((row) => {
      const engagement = engagements.find((e) => e.engagement_id === row.engagement_id);
      const since = lastNote.get(`${row.engagement_id}:${row.profile_id}`) ?? null;
      const after = (iso: string) => (since ? new Date(iso) > new Date(since) : true);

      const subjectDecisions = decisions.filter(
        (d) => d.owner_id === row.profile_id && d.engagement_id === row.engagement_id,
      );
      const subjectElements = mapped.filter(
        (m) => m.tasks?.owner_id === row.profile_id && m.tasks.engagement_id === row.engagement_id,
      );

      const stamps = [
        ...subjectDecisions.map((d) => d.created_at),
        ...subjectElements.map((m) => m.mapped_at),
      ].sort();

      return {
        engagement_id: row.engagement_id,
        engagement_code: engagement?.engagements
          ? (engagementDisplayCode(engagement.engagements) ?? "Folder")
          : "Not set",
        engagement_title: engagement?.engagements
          ? engagementDisplayTitle(engagement.engagements)
          : "Engagement",
        subject_id: row.profile_id,
        subject_name: row.profiles?.display_name ?? "Colleague",
        last_note_at: since,
        total_decisions: subjectDecisions.length,
        total_elements: subjectElements.length,
        new_decisions: subjectDecisions.filter((d) => after(d.created_at)).length,
        new_elements: subjectElements.filter((m) => after(m.mapped_at)).length,
        last_activity: stamps.length > 0 ? (stamps[stamps.length - 1] as string) : null,
      };
    });

  return rows.sort((a, b) => (b.last_activity ?? "").localeCompare(a.last_activity ?? ""));
}

/** Kept whole for callers and tests that want one call rather than two queries. */
export async function fetchCoachSubjects(coachProfileId: string): Promise<CoachSubject[]> {
  const roster = await fetchCoachRoster(coachProfileId);
  if (roster.engagements.length === 0) return [];
  const activity = await fetchCoachActivity(
    coachProfileId,
    roster.engagements.map((row) => row.engagement_id),
  );
  return composeCoachSubjects(coachProfileId, roster, activity);
}

export function coachRosterKey(coachProfileId: string) {
  return ["coach-subjects", coachProfileId] as const;
}

export function coachActivityKey(coachProfileId: string) {
  return ["coach-activity", coachProfileId] as const;
}

export function useCoachSubjects(coachProfileId: string | undefined) {
  const roster = useQuery({
    queryKey: coachRosterKey(coachProfileId ?? ""),
    queryFn: () => fetchCoachRoster(coachProfileId as string),
    enabled: Boolean(coachProfileId),
    ...COACH_POLL,
  });
  const ids = (roster.data?.engagements ?? []).map((row) => row.engagement_id);
  const activity = useQuery({
    queryKey: [...coachActivityKey(coachProfileId ?? ""), ids.join(",")],
    queryFn: () => fetchCoachActivity(coachProfileId as string, ids),
    enabled: Boolean(coachProfileId) && ids.length > 0,
    staleTime: COACH_ACTIVITY_STALE_TIME,
  });

  const data = roster.data
    ? composeCoachSubjects(
        coachProfileId as string,
        roster.data,
        activity.data ?? EMPTY_COACH_ACTIVITY,
      )
    : undefined;

  return {
    data,
    isLoading: roster.isLoading,
    error: (roster.error ?? null) as Error | null,
  };
}

export type CoachSubjectAcrossOrgs = CoachSubject & {
  coach_profile_id: string;
  org_name: string;
};

/** A coach may hold profiles in several orgs; the queue spans all of them. */
export function useAllCoachSubjects(profiles: Profile[]) {
  const coachProfiles = profiles.filter((p) => p.role === "coach");
  const rosters = useQueries({
    queries: coachProfiles.map((profile) => ({
      queryKey: coachRosterKey(profile.id),
      queryFn: () => fetchCoachRoster(profile.id),
      ...COACH_POLL,
    })),
  });

  const activities = useQueries({
    queries: coachProfiles.map((profile, index) => {
      const ids = (rosters[index]?.data?.engagements ?? []).map((row) => row.engagement_id);
      return {
        queryKey: [...coachActivityKey(profile.id), ids.join(",")],
        queryFn: () => fetchCoachActivity(profile.id, ids),
        enabled: ids.length > 0,
        staleTime: COACH_ACTIVITY_STALE_TIME,
      };
    }),
  });

  const data: CoachSubjectAcrossOrgs[] = rosters.flatMap((result, index) => {
    const profile = coachProfiles[index];
    if (!profile || !result.data) return [];
    const activity = activities[index]?.data ?? EMPTY_COACH_ACTIVITY;
    return composeCoachSubjects(profile.id, result.data, activity).map((subject) => ({
      ...subject,
      coach_profile_id: profile.id,
      org_name: profile.org_name,
    }));
  });

  return {
    data: data.sort((a, b) => (b.last_activity ?? "").localeCompare(a.last_activity ?? "")),
    isLoading: rosters.some((r) => r.isLoading),
    error: (rosters.find((r) => r.error)?.error ?? null) as Error | null,
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
      .order("position", { ascending: true }),
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
