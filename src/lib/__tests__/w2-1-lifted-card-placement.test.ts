import { describe, expect, it } from "vitest";

import { setWorkItemStandalone } from "../work-standalone.server";

/* A very small stand-in for the caller-scoped client, tables in memory. */
type Store = Record<string, Record<string, unknown>[]>;

function makeDb(store: Store) {
  function chain(table: string) {
    const filters: ((row: Record<string, unknown>) => boolean)[] = [];
    let mode: "select" | "update" | "insert" = "select";
    let patch: Record<string, unknown> = {};
    let inserted: Record<string, unknown> | null = null;
    let cap: number | null = null;

    const rows = () => (store[table] ?? []).filter((r) => filters.every((f) => f(r)));

    const settle = () => {
      if (mode === "insert") {
        const row = { id: `${table}-${(store[table] ?? []).length + 1}`, version: 1, ...inserted };
        store[table] = [...(store[table] ?? []), row];
        return { data: row, error: null };
      }
      if (mode === "update") {
        const touched = rows();
        for (const row of touched) Object.assign(row, patch);
        return { data: touched, error: null };
      }
      return { data: cap === null ? rows() : rows().slice(0, cap), error: null };
    };

    const api: Record<string, unknown> = {
      select: () => api,
      insert: (value: Record<string, unknown>) => {
        mode = "insert";
        inserted = value;
        return api;
      },
      update: (value: Record<string, unknown>) => {
        mode = "update";
        patch = value;
        return api;
      },
      eq: (column: string, value: unknown) => {
        filters.push((r) => r[column] === value);
        return api;
      },
      in: (column: string, values: unknown[]) => {
        filters.push((r) => values.includes(r[column]));
        return api;
      },
      is: (column: string, value: unknown) => {
        filters.push((r) => (r[column] ?? null) === value);
        return api;
      },
      limit: (n: number) => {
        cap = n;
        return api;
      },
      maybeSingle: async () => ({
        data: (settle().data as Record<string, unknown>[])[0] ?? null,
        error: null,
      }),
      single: async () => {
        const out = settle();
        const data = Array.isArray(out.data) ? out.data[0] ?? null : out.data;
        return { data, error: null };
      },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(settle()).then(resolve),
    };
    return api;
  }

  return { db: { from: (table: string) => chain(table) } as never, store };
}

const profile = { id: "me", org_id: "org", role: "lead" as const };

function boardStore(): Store {
  return {
    work_items: [
      { id: "t", type: "ai_thread", owner_id: "me", orig_conversation_id: "c1", source_meta: { role: "transcript" }, ungrouped_at: null },
      { id: "a0", type: "document", owner_id: "me", orig_conversation_id: "c1", source_meta: { role: "attachment" }, ungrouped_at: null },
      { id: "a1", type: "document", owner_id: "me", orig_conversation_id: "c1", source_meta: { role: "attachment" }, ungrouped_at: null },
    ],
    workboards: [{ id: "b1", engagement_id: "e1" }],
    // The conversation sits well away from the origin, where a person put it.
    workboard_nodes: [
      { id: "n-chat", workboard_id: "b1", work_item_id: "t", kind: "work_item", x: 900, y: 600, w: 260, h: 180, deleted_at: null },
    ],
    workboard_links: [],
    engagement_members: [{ engagement_id: "e1", profile_id: "me", member_role: "lead" }],
  };
}

type Rect = { x: number; y: number; w: number; h: number };

function rectOf(store: Store, workItemId: string): Rect {
  const node = (store["workboard_nodes"] ?? []).find((row) => row["work_item_id"] === workItemId);
  expect(node, `no card for ${workItemId}`).toBeTruthy();
  return { x: Number(node!["x"]), y: Number(node!["y"]), w: Number(node!["w"]), h: Number(node!["h"]) };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe("W2.1 — a lifted artifact lands beside its chat, in free space", () => {
  it("never stacks two lifted artifacts on each other, and never at the board origin", async () => {
    const store = boardStore();
    const { db } = makeDb(store);

    await setWorkItemStandalone(db, profile, { workItemId: "a0", standAlone: true });
    await setWorkItemStandalone(db, profile, { workItemId: "a1", standAlone: true });

    const first = rectOf(store, "a0");
    const second = rectOf(store, "a1");

    expect(first).not.toEqual({ x: 0, y: 0, w: first.w, h: first.h });
    expect({ x: first.x, y: first.y }).not.toEqual({ x: 0, y: 0 });
    expect({ x: second.x, y: second.y }).not.toEqual({ x: 0, y: 0 });
    expect(overlaps(first, second)).toBe(false);
  });

  it("puts each one within reach of the conversation's own card, not across the board", async () => {
    const store = boardStore();
    const { db } = makeDb(store);
    await setWorkItemStandalone(db, profile, { workItemId: "a0", standAlone: true });

    const chat = rectOf(store, "t");
    const card = rectOf(store, "a0");
    expect(Math.abs(card.x - chat.x)).toBeLessThanOrEqual(900);
    expect(Math.abs(card.y - chat.y)).toBeLessThanOrEqual(900);
    expect(overlaps(card, chat)).toBe(false);
  });

  it("clears the cards already on the board rather than landing on them", async () => {
    const store = boardStore();
    store["workboard_nodes"]!.push({
      id: "n-other",
      workboard_id: "b1",
      work_item_id: "other",
      kind: "work_item",
      x: 1200,
      y: 600,
      w: 260,
      h: 180,
      deleted_at: null,
    });
    const { db } = makeDb(store);
    await setWorkItemStandalone(db, profile, { workItemId: "a0", standAlone: true });

    const card = rectOf(store, "a0");
    expect(overlaps(card, { x: 1200, y: 600, w: 260, h: 180 })).toBe(false);
  });

  it("gives the card the same height a person gets when they add one by hand", async () => {
    const store = boardStore();
    const { db } = makeDb(store);
    await setWorkItemStandalone(db, profile, { workItemId: "a0", standAlone: true });
    expect(rectOf(store, "a0")).toMatchObject({ w: 260, h: 180 });
  });
});
