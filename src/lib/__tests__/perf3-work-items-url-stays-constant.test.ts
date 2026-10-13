import { beforeEach, describe, expect, it, vi } from "vitest";

// PERF-3: the work_item_tasks read must carry no enumerated id list. Row
// policies already bound what the caller receives, so the request URL stays
// constant length no matter how large a person's record grows.
const h = vi.hoisted(() => {
  type Call = { method: string; args: unknown[] };
  const state = {
    calls: {} as Record<string, Call[]>,
    results: {} as Record<string, { data: unknown; error: unknown }>,
  };
  function builder(table: string) {
    const callsOf = (t: string): Call[] => (state.calls[t] ??= []);
    const b: any = {
      select: (...args: unknown[]) => {
        callsOf(table).push({ method: "select", args });
        return b;
      },
      order: (...args: unknown[]) => {
        callsOf(table).push({ method: "order", args });
        return b;
      },
      in: (...args: unknown[]) => {
        callsOf(table).push({ method: "in", args });
        return b;
      },
      then: (
        onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) =>
        Promise.resolve(
          state.results[table] ?? { data: [], error: null },
        ).then(onFulfilled, onRejected),
    };
    return b;
  }
  const supabase = { from: (table: string) => builder(table) };
  return { state, supabase };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: h.supabase }));

import { fetchWorkItems } from "@/hooks/use-work-items";

describe("PERF-3 work items URL stays constant", () => {
  beforeEach(() => {
    h.state.calls = {};
    h.state.results = {
      work_items: {
        data: [
          { id: "w1", owner_id: "u1", title: "Note one" },
          { id: "w2", owner_id: "u1", title: "Note two" },
        ],
        error: null,
      },
      work_item_tasks: {
        data: [
          {
            work_item_id: "w1",
            task_id: "t1",
            tasks: { id: "t1", name: "Task one" },
          },
          {
            work_item_id: "missing-item",
            task_id: "t2",
            tasks: { id: "t2", name: "Task two" },
          },
        ],
        error: null,
      },
    };
  });

  it("does not enumerate ids in the work_item_tasks query", async () => {
    await fetchWorkItems();
    const calls = h.state.calls["work_item_tasks"] ?? [];
    expect(calls.some((call) => call.method === "in")).toBe(false);
  });

  it("keeps the work_item_tasks select shape unchanged", async () => {
    await fetchWorkItems();
    const calls = h.state.calls["work_item_tasks"] ?? [];
    const select = calls.find((call) => call.method === "select");
    expect(select).toBeDefined();
    expect(String(select!.args[0])).toContain("work_item_id, task_id, tasks(");
  });

  it("still merges placements onto the right items by work_item_id", async () => {
    const { items, mappingError } = await fetchWorkItems();
    expect(mappingError).toBeNull();
    expect(items).toHaveLength(2);
    const first = items.find((item) => item.id === "w1");
    expect(first!.work_item_tasks).toHaveLength(1);
    expect(first!.work_item_tasks[0]!.task_id).toBe("t1");
    const second = items.find((item) => item.id === "w2");
    expect(second!.work_item_tasks).toHaveLength(0);
  });

  it("ignores a placement row whose work_item_id is not on the page", async () => {
    await expect(fetchWorkItems()).resolves.toMatchObject({
      mappingError: null,
    });
    const second = (await fetchWorkItems()).items.find(
      (item) => item.id === "w2",
    );
    // The "missing-item" placement never attaches to any item and never throws.
    expect(second!.work_item_tasks).toHaveLength(0);
  });
});
