/**
 * S5a — what someone handed you, and who handed it.
 *
 * The mirror of coaching-reach.ts. Reach asks what a person may review. This
 * asks what another person is recorded as having given them, and attributes it
 * to that person by name. Nothing here reads or writes anything.
 *
 * The record either names who gave a board or it does not. When it does not,
 * this list says nothing at all: no placeholder, no fallback to the board, no
 * "someone". A board a person made for themselves looks exactly the same way.
 */

/** One membership of the viewer's own, with the names it needs to be read. */
export type SharedMembershipRow = {
  engagement_id: string;
  profile_id: string;
  member_role: string | null;
  added_by: string | null;
  engagement_title: string;
  engagement_code: string | null;
  granter_name: string;
};

export type SharedEngagement = { id: string; title: string; code: string | null };

export type SharedGroup = {
  granterId: string;
  granterName: string;
  engagements: SharedEngagement[];
};

/**
 * Both Review and Work are here, and they read the same. What a person may do
 * on a board is said on the board, not in a list of who handed it over.
 */
export function sharedWithMe(
  myProfileIds: readonly string[],
  rows: readonly SharedMembershipRow[],
): SharedGroup[] {
  const mine = new Set(myProfileIds);
  const byGranter = new Map<string, { name: string; engagements: Map<string, SharedEngagement> }>();

  for (const row of rows) {
    if (!mine.has(row.profile_id)) continue;
    const granter = row.added_by;
    if (!granter) continue;
    if (mine.has(granter)) continue;

    let group = byGranter.get(granter);
    if (!group) {
      group = { name: row.granter_name, engagements: new Map() };
      byGranter.set(granter, group);
    }
    if (!group.engagements.has(row.engagement_id)) {
      group.engagements.set(row.engagement_id, {
        id: row.engagement_id,
        title: row.engagement_title,
        code: row.engagement_code,
      });
    }
  }

  return Array.from(byGranter.entries())
    .map(([granterId, group]) => ({
      granterId,
      granterName: group.name,
      engagements: Array.from(group.engagements.values()).sort((a, b) =>
        a.title.localeCompare(b.title),
      ),
    }))
    .sort((a, b) => a.granterName.localeCompare(b.granterName));
}
