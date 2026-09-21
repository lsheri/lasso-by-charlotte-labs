/**
 * S4 — reach follows the grant.
 *
 * Whether a person may open a coaching surface is an engagement level fact:
 * it is decided by what they were given on a board, never by what their
 * workspace role happens to say. Nothing here reads or writes anything; the
 * database policies still own every rule about what comes back.
 *
 * The two choices are the ones already written in engagement-access-shared.
 * Review is read and comment on the record. Work is not Review.
 */
import { accessFromMemberRole } from "@/lib/engagement-access-shared";

/** One row of the person's own membership: the board, and what they hold. */
export type ReachMembership = {
  engagement_id: string;
  member_role: string | null;
};

/** The engagements this person may review, in the order they arrived, once each. */
export function reviewableEngagements(rows: readonly ReachMembership[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    if (accessFromMemberRole(row.member_role) !== "review") continue;
    seen.add(row.engagement_id);
  }
  return Array.from(seen);
}

/** No Review anywhere means no coaching surface at all, not an empty one. */
export function canReachCoaching(rows: readonly ReachMembership[]): boolean {
  return reviewableEngagements(rows).length > 0;
}
