/**
 * S4 (stickies on the work): the notifications a sticky sends. Written like mentions: who may receive one
 * is checked through the caller's own client first, then the row is written with the admin client through
 * notify(), because nobody can write another person's notification directly.
 *
 * - Assigned: the assignee hears it in Needs you, with the work and the spot. Never the note itself: a
 *   copy would outlive an edit or a removal in someone else's bell. The notification opens the sticky.
 * - Done: the author hears who marked it done (they asked that person). The rest of the board gets one
 *   grouped line a day, "2 stickies done", with no names and no note text: it is news about the work.
 *
 * Best effort throughout: a failed notification never fails the sticky.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { liftKindOf } from "@/lib/lift-view";
import type { ResolvedProfile } from "@/lib/profile-resolve";
import { stickyPlace, type StickyAnchor } from "@/lib/stickies-shared";

type Db = SupabaseClient<Database>;

export type StickyNotice = {
  engagementId: string;
  stickyId: string;
  workItemId: string;
  anchor: StickyAnchor;
};

type Context = { orgId: string; board: string; work: string; place: string; by: string; members: Set<string> };

/** Everything both notices need, read as the caller. Null when the caller is not on the board. */
async function contextFor(db: Db, profile: ResolvedProfile, notice: StickyNotice): Promise<Context | null> {
  const people = await db.rpc("board_people", { p_engagement: notice.engagementId });
  if (people.error || !Array.isArray(people.data)) return null;
  const [author, board, work] = await Promise.all([
    db.from("profiles").select("display_name").eq("id", profile.id).is("deactivated_at", null).maybeSingle(),
    db.from("engagements").select("title, org_id").eq("id", notice.engagementId).maybeSingle(),
    db.from("work_items").select("title, type").eq("id", notice.workItemId).maybeSingle(),
  ]);
  const by = author.data?.display_name?.trim();
  const title = board.data?.title?.trim();
  if (!by || !title || !board.data?.org_id) return null;
  return {
    orgId: board.data.org_id,
    board: title,
    work: work.data?.title?.trim() || "a piece of work",
    place: stickyPlace(notice.anchor, liftKindOf(work.data?.type)),
    by,
    members: new Set(people.data.map((person) => person.profile_id)),
  };
}

async function send(rows: Database["public"]["Functions"]["notify"]["Args"][]): Promise<number> {
  if (!rows.length) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let sent = 0;
  for (const row of rows) {
    try {
      const result = await supabaseAdmin.rpc("notify", row);
      if (result.error == null) sent += 1;
    } catch {
      // One recipient that cannot be reached must not stop the others.
    }
  }
  return sent;
}

/** The sticky asks this person to act. Never sent to yourself. */
export async function notifyStickyAssigned(
  db: Db,
  profile: ResolvedProfile,
  notice: StickyNotice,
  assigneeId: string,
): Promise<boolean> {
  try {
    if (!assigneeId || assigneeId === profile.id) return false;
    const ctx = await contextFor(db, profile, notice);
    if (!ctx || !ctx.members.has(assigneeId)) return false;
    const sent = await send([
      {
        p_recipient: assigneeId,
        p_org: ctx.orgId,
        p_kind: "sticky_assigned",
        p_section: "needs_you",
        // The bell opens a row's board from an "engagement" subject; the payload names the spot.
        p_subject_type: "engagement",
        p_subject_id: notice.engagementId,
        p_group_key: `sticky:${notice.stickyId}:assigned:${assigneeId}`,
        p_payload: {
          by: ctx.by,
          board: ctx.board,
          work: ctx.work,
          place: ctx.place,
          sticky_id: notice.stickyId,
          work_item_id: notice.workItemId,
        },
      },
    ]);
    return sent > 0;
  } catch {
    return false;
  }
}

/**
 * Marked done. The author hears who did it, unless they did it themselves. Everyone else on the board,
 * except the person who marked it, gets the day's grouped count. Only stickies that asked someone to act
 * make board news; an author ticking off their own note stays quiet.
 */
export async function notifyStickyDone(
  db: Db,
  profile: ResolvedProfile,
  notice: StickyNotice,
  authorId: string,
  wasAssigned: boolean,
): Promise<void> {
  try {
    const ctx = await contextFor(db, profile, notice);
    if (!ctx) return;
    const rows: Database["public"]["Functions"]["notify"]["Args"][] = [];
    if (authorId !== profile.id && ctx.members.has(authorId)) {
      rows.push({
        p_recipient: authorId,
        p_org: ctx.orgId,
        p_kind: "sticky_done",
        p_section: "updates",
        p_subject_type: "engagement",
        p_subject_id: notice.engagementId,
        p_group_key: `sticky:${notice.stickyId}:done:${authorId}`,
        p_payload: {
          by: ctx.by,
          board: ctx.board,
          work: ctx.work,
          place: ctx.place,
          sticky_id: notice.stickyId,
          work_item_id: notice.workItemId,
        },
      });
    }
    if (wasAssigned) {
      const day = new Date().toISOString().slice(0, 10);
      for (const member of ctx.members) {
        if (member === authorId || member === profile.id) continue;
        rows.push({
          p_recipient: member,
          p_org: ctx.orgId,
          p_kind: "board_activity",
          p_section: "updates",
          p_subject_type: "engagement",
          p_subject_id: notice.engagementId,
          p_group_key: `stickies_done:${notice.engagementId}:${day}`,
          // A board and a count. No names, no note, no piece of work.
          p_payload: { board: ctx.board, what: "stickies_done" },
        });
      }
    }
    await send(rows);
  } catch {
    // Best effort. The sticky is already done.
  }
}
