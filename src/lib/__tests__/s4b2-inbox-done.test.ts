import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { ResolvedProfile } from "@/lib/profile-resolve";

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

import { setStickyDone } from "@/lib/stickies.server";

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
      if (table === "notifications") return null;
      return null;
    };
    const many = (): Row[] =>
      table === "notifications"
        ? [{ id: "n1" }]
        : table === "profiles"
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


const sent = () => mocks.notify.mock.calls.map((call) => call[1] as Record<string, unknown>);
beforeEach(() => vi.clearAllMocks());

describe("S4b-2 marking done from the inbox", () => {
  it("with no version in hand, reads the current one and marks it done", async () => {
    const { db, rpc } = fakeDb({ sticky: { assignee_profile_id: "ben", version: 4 } });
    const result = await setStickyDone(db, ben, "s1", true, null);
    expect(result.status).toBe("saved");
    expect(rpc).toHaveBeenCalledWith("set_sticky_done", { p_annotation: "s1", p_done: true, p_expected_version: 4 });
  });
  it("settles the assignee's own 'left you a sticky' row, wherever the tick happened", async () => {
    const { db, rpc } = fakeDb({ sticky: { assignee_profile_id: "ben" } });
    await setStickyDone(db, ben, "s1", true, 1);
    expect(rpc).toHaveBeenCalledWith("mark_notifications", { p_ids: ["n1"], p_acted: true });
  });
  it("the author ticking it settles nobody's row; the rest of the board hears the count", async () => {
    const { db, rpc } = fakeDb({ sticky: { assignee_profile_id: "ben" }, members: ["ben", "kim"] });
    await setStickyDone(db, me, "s1", true, 1);
    expect(rpc).not.toHaveBeenCalledWith("mark_notifications", expect.anything());
    // Everyone else on the board, the person it asked included, hears the day's count.
    expect(sent().map((n) => [n["p_recipient"], n["p_kind"]])).toEqual([
      ["ben", "board_activity"],
      ["kim", "board_activity"],
    ]);
  });
  it("reopening never settles anything", async () => {
    const { db, rpc } = fakeDb({ sticky: { assignee_profile_id: "ben", done_at: "x", done_by: "ben" } });
    await setStickyDone(db, ben, "s1", false, 1);
    expect(rpc).not.toHaveBeenCalledWith("mark_notifications", expect.anything());
  });
});
