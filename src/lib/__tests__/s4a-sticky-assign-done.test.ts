import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { ResolvedProfile } from "@/lib/profile-resolve";
import { NOTIFICATION_COPY, notificationSentence } from "@/lib/notifications-shared";

const mocks = vi.hoisted(() => ({
  notify: vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: null })),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.notify } }));
vi.mock("@/lib/canvas-lab.server", () => ({
  boardSeatFor: async (_db: unknown, _e: unknown, profile: unknown) => profile,
  ensureBoard: async () => ({ id: "wb" }),
  ensureWorkItemNode: async () => "node",
  findBoardFor: async () => ({ id: "wb" }),
  isEngagementEditor: async () => true,
}));

import { createSticky, editSticky, setStickyDone } from "@/lib/stickies.server";

const me = { id: "me", org_id: "org", role: "em" } as ResolvedProfile;
const ben = { id: "ben", org_id: "org", role: "em" } as ResolvedProfile;

type Row = Record<string, unknown>;

/** A small in-memory stand-in for the caller's client: one sticky, a board, its people. */
function fakeDb(options: { sticky?: Row; members?: string[]; done?: Row[] | null } = {}) {
  let sticky: Row = {
    id: "s1",
    workboard_id: "wb",
    work_item_id: "w",
    kind: "sticky",
    anchor_kind: "page",
    page_no: 3,
    turn_no: null,
    section_key: null,
    row_key: null,
    turn_hash: null,
    pos_x: 0.5,
    pos_y: 0.5,
    fill: "yellow",
    body: "Lead with the 41% here.",
    visibility: "engagement",
    author_profile_id: "me",
    assignee_profile_id: null,
    done_at: null,
    done_by: null,
    version: 1,
    created_at: "2026-11-10T00:00:00Z",
    ...options.sticky,
  };
  const writes: { table: string; kind: "insert" | "update"; value: Row }[] = [];
  const rpc = vi.fn(async (name: string, _args?: Record<string, unknown>) => {
    if (name === "board_people")
      return {
        data: (options.members ?? ["ben", "kim"]).map((id) => ({ profile_id: id, display_name: id })),
        error: null,
      };
    if (name === "set_sticky_done") {
      const out = options.done === undefined ? [{ id: "s1", version: 2 }] : options.done;
      if (out && out.length) {
        const args = _args as { p_done: boolean };
        sticky = {
          ...sticky,
          version: 2,
          done_at: args.p_done ? "2026-11-10T01:00:00Z" : null,
          done_by: args.p_done ? "ben" : null,
        };
      }
      return { data: out, error: null };
    }
    return { data: null, error: null };
  });
  const from = vi.fn((table: string) => {
    const one = (): Row | null => {
      if (table === "workboard_annotations") return { ...sticky };
      if (table === "workboards") return { id: "wb", engagement_id: "eng" };
      if (table === "engagements") return { title: "CS Program Recommendation", org_id: "org" };
      if (table === "work_items") return { title: "CVCC deck", type: "deck" };
      if (table === "profiles") return { display_name: "Liam Sheridan" };
      if (table === "turns") return { content_hash: "h" };
      return null;
    };
    const many = (): Row[] =>
      table === "profiles"
        ? [
            { id: "me", display_name: "Liam Sheridan" },
            { id: "ben", display_name: "Ben Stanton" },
            { id: "kim", display_name: "Kim Ito" },
          ]
        : [];
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      insert: vi.fn((value: Row) => {
        writes.push({ table, kind: "insert", value });
        if (table === "workboard_annotations") sticky = { ...sticky, ...value, id: "s1" };
        return chain;
      }),
      update: vi.fn((value: Row) => {
        writes.push({ table, kind: "update", value });
        if (table === "workboard_annotations") sticky = { ...sticky, ...value, version: Number(sticky["version"]) + 1 };
        return chain;
      }),
      single: async () => ({ data: one(), error: null }),
      maybeSingle: async () => ({ data: one(), error: null }),
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
        resolve({ data: many(), error: null }),
    });
    return chain;
  });
  return { db: { rpc, from } as unknown as SupabaseClient<Database>, rpc, writes };
}

const base = {
  engagementId: "eng",
  workItemId: "w",
  anchor: { kind: "page" as const, pageNo: 3 },
  posX: 0.4,
  posY: 0.6,
  fill: "yellow" as const,
  body: "Lead with the 41% here.",
  visibility: "engagement" as const,
  clientKey: "k1",
};

const sent = () => mocks.notify.mock.calls.map((call) => call[1] as Record<string, unknown>);

beforeEach(() => vi.clearAllMocks());

describe("S4a assigning a sticky", () => {
  it("asks someone on the board, and tells them where, never what the note says", async () => {
    const { db, writes } = fakeDb();
    const result = await createSticky(db, me, { ...base, assigneeProfileId: "ben" });
    expect(result.status).toBe("saved");
    expect(writes.find((w) => w.kind === "insert")?.value).toMatchObject({ assignee_profile_id: "ben" });
    expect(sent()).toEqual([
      {
        p_recipient: "ben",
        p_org: "org",
        p_kind: "sticky_assigned",
        p_section: "needs_you",
        p_subject_type: "engagement",
        p_subject_id: "eng",
        p_group_key: "sticky:s1:assigned:ben",
        p_payload: {
          by: "Liam Sheridan",
          board: "CS Program Recommendation",
          work: "CVCC deck",
          place: "Slide 3",
          sticky_id: "s1",
          work_item_id: "w",
        },
      },
    ]);
    expect(JSON.stringify(sent())).not.toContain("41%");
    if (result.status === "saved") expect(result.sticky.assigneeName).toBe("Ben Stanton");
  });
  it("refuses someone who is not on the board, before anything is written", async () => {
    const { db, writes } = fakeDb({ members: ["kim"] });
    const result = await createSticky(db, me, { ...base, assigneeProfileId: "outsider" });
    expect(result).toEqual({ status: "validation_error", message: "Assign a sticky to someone on this board." });
    expect(writes).toHaveLength(0);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("a just-me sticky cannot ask anyone", async () => {
    const { db, writes } = fakeDb();
    const result = await createSticky(db, me, { ...base, visibility: "just_me", assigneeProfileId: "ben" });
    expect(result.status).toBe("validation_error");
    expect(writes).toHaveLength(0);
  });
  it("assigning yourself is allowed and sends nothing", async () => {
    const { db } = fakeDb();
    const result = await createSticky(db, me, { ...base, assigneeProfileId: "me" });
    expect(result.status).toBe("saved");
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("choosing someone new reopens the sticky and tells only them", async () => {
    const { db, writes } = fakeDb({
      sticky: { assignee_profile_id: "kim", done_at: "2026-11-09T00:00:00Z", done_by: "kim" },
    });
    const result = await editSticky(db, me, { id: "s1", expectedVersion: 1, assigneeProfileId: "ben" });
    expect(result.status).toBe("saved");
    expect(writes.find((w) => w.kind === "update")?.value).toMatchObject({
      assignee_profile_id: "ben",
      done_at: null,
      done_by: null,
    });
    expect(sent().map((n) => n["p_recipient"])).toEqual(["ben"]);
  });
  it("saving the same assignee again sends nothing and leaves done alone", async () => {
    const { db, writes } = fakeDb({ sticky: { assignee_profile_id: "ben" } });
    await editSticky(db, me, { id: "s1", expectedVersion: 1, assigneeProfileId: "ben", body: "New words" });
    expect(writes.find((w) => w.kind === "update")?.value).not.toHaveProperty("done_at");
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});

describe("S4a marking done", () => {
  it("the assignee marks it done: the author hears who, the rest of the board hears a count", async () => {
    const { db, rpc } = fakeDb({ sticky: { assignee_profile_id: "ben" }, members: ["me", "kim"] });
    const result = await setStickyDone(db, ben, "s1", true, 1);
    expect(rpc).toHaveBeenCalledWith("set_sticky_done", { p_annotation: "s1", p_done: true, p_expected_version: 1 });
    expect(result.status).toBe("saved");
    const rows = sent();
    expect(rows.map((n) => [n["p_recipient"], n["p_kind"]])).toEqual([
      ["me", "sticky_done"],
      ["kim", "board_activity"],
    ]);
    // The board line is a board and a count: no names, no note, no piece of work.
    expect(rows[1]?.["p_payload"]).toEqual({ board: "CS Program Recommendation", what: "stickies_done" });
    expect(String(rows[1]?.["p_group_key"])).toMatch(/^stickies_done:eng:\d{4}-\d{2}-\d{2}$/);
    if (result.status === "saved") expect(result.sticky.doneByName).toBe("You");
  });
  it("an author closing their own unassigned note stays quiet", async () => {
    const { db } = fakeDb({ members: ["ben", "kim"] });
    await setStickyDone(db, me, "s1", true, 1);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("reopening sends nothing", async () => {
    const { db } = fakeDb({ sticky: { assignee_profile_id: "ben", done_at: "x", done_by: "ben" } });
    await setStickyDone(db, ben, "s1", false, 1);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("when the sticky moved on, nothing changes and nobody hears", async () => {
    const { db } = fakeDb({ sticky: { assignee_profile_id: "ben" }, done: [] });
    expect(await setStickyDone(db, ben, "s1", true, 1)).toEqual({ status: "conflict" });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});

describe("S4a notification words", () => {
  it("names the work and the spot", () => {
    expect(
      notificationSentence({
        kind: "sticky_assigned",
        payload: { by: "Liam", work: "CVCC deck", place: "Slide 3" },
      }),
    ).toBe("Liam left you a sticky on CVCC deck, Slide 3.");
    expect(
      notificationSentence({ kind: "sticky_done", payload: { by: "Ben", work: "CVCC deck", place: "Slide 3" } }),
    ).toBe("Ben marked your sticky on CVCC deck, Slide 3 done.");
  });
  it("the board line counts stickies, and new cards still read as cards", () => {
    expect(
      notificationSentence({ kind: "board_activity", payload: { board: "Pricing", what: "stickies_done", count: 2 } }),
    ).toBe("Pricing: 2 stickies done.");
    expect(NOTIFICATION_COPY.stickiesDone("Pricing", 1)).toBe("Pricing: 1 sticky done.");
    expect(notificationSentence({ kind: "board_activity", payload: { board: "Pricing", count: 3 } })).toBe(
      "Pricing: 3 new cards.",
    );
  });
});

describe("S4a author-only, pinned in source", () => {
  const migration = readFileSync("supabase/migrations/20261110230000_s4a_sticky_assign_done_author_only.sql", "utf8");
  const annotations = readFileSync("src/lib/canvas-lab-annotations.server.ts", "utf8");
  it("the update policy is the author's alone: no admin path", () => {
    const policy = migration.slice(migration.indexOf("create policy"), migration.indexOf("create or replace function"));
    expect(policy).toContain("author_profile_id in (select public.my_profile_ids())");
    expect(policy).not.toMatch(/has_org_role|admin/);
  });
  it("every function restates security definer and its search path", () => {
    const fns = migration.split(/create or replace function/i).slice(1);
    expect(fns).toHaveLength(2);
    for (const fn of fns) {
      expect(fn).toMatch(/\n security definer\n/);
      expect(fn).toContain("set search_path to 'public'");
    }
  });
  it("the assignee can move done and nothing else; the anchor's row is fixed", () => {
    expect(migration).toContain("array['done_at','done_by','updated_by','updated_at','version']");
    expect(migration).toContain("new.row_key is distinct from old.row_key");
    expect(migration).toContain("new.done_at := null; new.done_by := null;");
  });
  it("only signed-in people can call set_sticky_done", () => {
    expect(migration).toContain("revoke all on function public.set_sticky_done(uuid, boolean, integer) from public, anon;");
    expect(migration).toContain("grant execute on function public.set_sticky_done(uuid, boolean, integer) to authenticated;");
  });
  it("comment and highlight edits and removals filter by author on the server too", () => {
    for (const name of ["archiveHighlight", "setHighlightVisibility", "editComment", "archiveComment"]) {
      const start = annotations.indexOf(`export async function ${name}(`);
      const body = annotations.slice(start, annotations.indexOf("\nexport async function", start + 10));
      expect(body, name).toContain('.eq("author_profile_id", profile.id)');
    }
  });
});
