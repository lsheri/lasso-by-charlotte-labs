import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * S4c: the three gaps found by simulating stickies across boards and accounts as real users (in transactions
 * that always rolled back), and the fix proven the same way (18 of 18, 10 Nov). Pinned here so a later
 * change to the guard cannot quietly reopen them.
 */
const sql = readFileSync("supabase/migrations/20261111000000_s4c_sticky_gaps.sql", "utf8");

describe("S4c the migration", () => {
  it("every function restates security definer and its search path", () => {
    const fns = sql.split(/create or replace function/i).slice(1);
    expect(fns).toHaveLength(3);
    for (const fn of fns) {
      expect(fn).toMatch(/\n security definer\n/);
      expect(fn).toContain("set search_path to 'public'");
    }
  });
  it("a note is signed by the author's own non-coach seat on that board", () => {
    expect(sql).toContain("em.profile_id = new.author_profile_id and em.member_role <> 'coach'");
    expect(sql).toContain("Write on this board as your seat on it.");
  });
  it("who did it changes only with a new tick, and only to the person ticking", () => {
    expect(sql).toContain(
      "and (new.done_by is distinct from new.updated_by or new.done_at is not distinct from old.done_at) then raise exception 'Done records who marked it.'",
    );
  });
  it("leaving a board clears open stickies that ask you, through a narrow system path", () => {
    expect(sql).toContain("after delete on public.engagement_members");
    expect(sql).toContain("a.done_at is null and a.archived_at is null");
    expect(sql).toContain("(to_jsonb(new) - array['assignee_profile_id','updated_at','version']) = (to_jsonb(old) - array['assignee_profile_id','updated_at','version'])");
    expect(sql).toContain("perform set_config('lasso.system_write', 'off', true);");
  });
  it("'left you a sticky' settles when the sticky is done, unassigned, reassigned or removed", () => {
    expect(sql).toContain("after update on public.workboard_annotations");
    expect(sql).toContain("group_key = 'sticky:' || old.id || ':assigned:' || old.assignee_profile_id");
  });
  it("nobody can call the trigger functions directly", () => {
    expect(sql).toContain("revoke all on function public.clear_sticky_assignee_on_leave() from public, anon, authenticated;");
    expect(sql).toContain("revoke all on function public.settle_sticky_assigned_notice() from public, anon, authenticated;");
  });
  it("keeps everything S4a established", () => {
    for (const kept of [
      "new.row_key is distinct from old.row_key",
      "new.done_at := null; new.done_by := null;",
      "array['done_at','done_by','updated_by','updated_at','version']",
      "Assign a sticky to someone on this board.",
    ])
      expect(sql).toContain(kept);
  });
});
