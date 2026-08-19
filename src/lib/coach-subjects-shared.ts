/**
 * The coach queue, shared shapes and the pure join behind it.
 *
 * Nothing here touches a client or a database. The server function composes
 * with these so the browser receives one finished payload rather than a
 * fan out of reads it has to stitch together itself.
 */
import { engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";

/**
 * engagement_members has two foreign keys to profiles (profile_id and
 * added_by), so every embed must name the relationship. This pins the
 * subject side; the sharer side uses engagement_members_added_by_fkey.
 * Kept byte identical to the copy documented in hooks/use-coaching.ts.
 */
export const COACH_SUBJECTS_SELECT =
  "engagement_id, profile_id, profiles!engagement_members_profile_id_fkey(id, display_name)";

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

export type CoachSubjectAcrossOrgs = CoachSubject & {
  coach_profile_id: string;
  org_name: string;
};

export type CoachEngagementRow = {
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

/** Pure join of roster and activity, so neither read has to know the other. */
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

/** One list across every org this person coaches in, newest activity first. */
export function sortAcrossOrgs(rows: CoachSubjectAcrossOrgs[]): CoachSubjectAcrossOrgs[] {
  return [...rows].sort((a, b) => (b.last_activity ?? "").localeCompare(a.last_activity ?? ""));
}
