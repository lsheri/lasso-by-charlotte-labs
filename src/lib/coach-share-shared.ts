/**
 * Sharing is owner driven. The list a person can share from is built from
 * their OWN engagement memberships, never from the org's engagements, so an
 * admin who does not work on an engagement is never offered it here.
 */

export type ShareableEngagement = {
  id: string;
  code: string;
  title: string;
  client_label: string | null;
  clients: { id: string; name: string; quick_folder: boolean } | null;
  shared: boolean;
  added_at: string | null;
  added_by_name: string | null;
};

export const ADMIN_HONESTY_LINE =
  "Only engagements you work on are listed. Sharing is done by the people doing the work.";

/** Every surface that shows share state invalidates these, so none goes stale. */
export function coachShareKey(profileId: string, coachProfileId: string) {
  return ["coach-share", profileId, coachProfileId] as const;
}

export function sharedLine(added_at: string | null, added_by_name: string | null): string | null {
  if (!added_at) return null;
  const when = new Date(added_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return added_by_name ? `Shared ${when} by ${added_by_name}` : `Shared ${when}`;
}

type MembershipRow = {
  engagement_id: string;
  member_role: string;
  engagements: {
    id: string;
    code: string;
    title: string;
    client_label: string | null;
    clients: { id: string; name: string; quick_folder: boolean } | null;
  } | null;
};

type CoachRow = {
  engagement_id: string;
  added_at: string | null;
  added_by_profile: { display_name: string } | null;
};

/** Minimal shape of the Supabase client this reader needs, so it can be stubbed. */
export type ShareQueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => ThenableFilter;
    };
  };
};

type ThenableFilter = {
  eq: (column: string, value: string) => ThenableFilter;
  neq: (column: string, value: string) => ThenableFilter;
  in: (column: string, values: string[]) => ThenableFilter;
  then: (
    resolve: (value: { data: unknown; error: { message: string } | null }) => unknown,
  ) => Promise<unknown>;
};

export async function fetchShareableEngagements(
  client: ShareQueryClient,
  input: { profileId: string; coachProfileId: string },
): Promise<ShareableEngagement[]> {
  const mine = (await client
    .from("engagement_members")
    .select(
      "engagement_id, member_role, engagements(id, code, title, client_label, clients(id, name, quick_folder))",
    )
    .eq("profile_id", input.profileId)
    .neq("member_role", "coach")) as unknown as {
    data: MembershipRow[] | null;
    error: { message: string } | null;
  };
  if (mine.error) throw new Error(mine.error.message);

  const rows = (mine.data ?? []).filter((row) => row.engagements !== null);
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.engagement_id);

  const theirs = (await client
    .from("engagement_members")
    .select(
      "engagement_id, added_at, added_by_profile:profiles!engagement_members_added_by_fkey(display_name)",
    )
    .eq("profile_id", input.coachProfileId)
    .eq("member_role", "coach")
    .in("engagement_id", ids)) as unknown as {
    data: CoachRow[] | null;
    error: { message: string } | null;
  };
  if (theirs.error) throw new Error(theirs.error.message);

  const shared = new Map<string, CoachRow>();
  for (const row of theirs.data ?? []) shared.set(row.engagement_id, row);

  return rows
    .map((row) => {
      const engagement = row.engagements!;
      const match = shared.get(row.engagement_id);
      return {
        id: engagement.id,
        code: engagement.code,
        title: engagement.title,
        client_label: engagement.client_label,
        clients: engagement.clients,
        shared: Boolean(match),
        added_at: match?.added_at ?? null,
        added_by_name: match?.added_by_profile?.display_name ?? null,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}