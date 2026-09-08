import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  isStructural,
  linkState,
  neutralLabel,
  type CoachingLinkRow,
  type CoachingLinkState,
} from "./coaching-access";

/**
 * PASS 170 — the link aware reads, all on the caller's own client so the row
 * level rules stay the single definition of who may see what. Nothing here
 * widens access, and nothing re-states the rule in a filter.
 */

type Client = SupabaseClient<Database>;

export const LINK_SELECT =
  "id, org_id, subject_profile_id, coach_profile_id, relation, scope, access_level, basis, agreement_ref, consented_at, consent_withdrawn_at, disclosed_at, ended_at, created_at";

export type CoachPerson = {
  link_id: string;
  subject_profile_id: string;
  subject_name: string;
  state: CoachingLinkState;
  structural: boolean;
  relation: string;
  access_level: string;
  basis: string;
};

export type SubjectLink = CoachingLinkRow & {
  coach_name: string | null;
  state: CoachingLinkState;
  structural: boolean;
};

async function names(supabase: Client, ids: string[]): Promise<Map<string, string>> {
  const wanted = Array.from(new Set(ids.filter(Boolean)));
  if (wanted.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", wanted);
  return new Map((data ?? []).map((row) => [row.id, row.display_name]));
}

/** Every link about this person, whatever state it is in. */
export async function listSubjectLinks(
  supabase: Client,
  subjectProfileId: string,
): Promise<SubjectLink[]> {
  const { data, error } = await supabase
    .from("coaching_links")
    .select(LINK_SELECT)
    .eq("subject_profile_id", subjectProfileId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CoachingLinkRow[];
  const coachNames = await names(
    supabase,
    rows.map((row) => row.coach_profile_id ?? ""),
  );
  return rows.map((row) => ({
    ...row,
    coach_name: row.coach_profile_id ? (coachNames.get(row.coach_profile_id) ?? null) : null,
    state: linkState(row),
    structural: isStructural(row),
  }));
}

/**
 * The people a coach may see. A pending consent link is not readable to them at
 * all, so it simply never appears; an ended or withdrawn link is reported as
 * access ended, with no reason attached.
 */
export async function listCoachPeople(
  supabase: Client,
  coachProfileId: string,
): Promise<CoachPerson[]> {
  const { data, error } = await supabase
    .from("coaching_links")
    .select(LINK_SELECT)
    .eq("coach_profile_id", coachProfileId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CoachingLinkRow[];
  const subjectNames = await names(
    supabase,
    rows.map((row) => row.subject_profile_id),
  );
  return rows.map((row) => {
    const structural = isStructural(row);
    const real = subjectNames.get(row.subject_profile_id) ?? "";
    return {
      link_id: row.id,
      subject_profile_id: row.subject_profile_id,
      // A structural coach still knows which person is which: the name of the
      // person they coach is the point of the relationship.
      subject_name: real || neutralLabel(row.id, row.subject_profile_id),
      state: linkState(row),
      structural,
      relation: row.relation,
      access_level: row.access_level,
      basis: row.basis,
    };
  });
}

export type SharedWorkRow = {
  id: string;
  type: string;
  work_date: string | null;
  captured_at: string;
  /** Real title for full transcript access, a neutral label otherwise. */
  label: string;
};

/**
 * What one link actually shares: mapped work only, private and unmapped never,
 * and the pieces the person kept back are absent. The person's own exclusions
 * are read only by them, so a coach never learns one exists.
 */
export async function listLinkWork(
  supabase: Client,
  link: CoachingLinkRow,
  options: { asSubject: boolean },
): Promise<SharedWorkRow[]> {
  if (linkState(link) !== "active") return [];
  const { data, error } = await supabase
    .from("work_items")
    .select("id, type, title, work_date, captured_at")
    .eq("owner_id", link.subject_profile_id)
    .eq("visibility", "mapped")
    .order("captured_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  let rows = data ?? [];
  if (options.asSubject) {
    const excluded = await listExclusions(supabase, link.id);
    const held = new Set(excluded);
    rows = rows.filter((row) => !held.has(row.id));
  }
  const structural = isStructural(link);
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    work_date: row.work_date,
    captured_at: row.captured_at,
    label: structural ? neutralLabel(link.id, row.id) : row.title,
  }));
}

/** Only the person whose work it is can read these. */
export async function listExclusions(supabase: Client, linkId: string): Promise<string[]> {
  const { data } = await supabase
    .from("coaching_item_exclusions")
    .select("work_item_id")
    .eq("link_id", linkId);
  return (data ?? []).map((row) => row.work_item_id);
}
