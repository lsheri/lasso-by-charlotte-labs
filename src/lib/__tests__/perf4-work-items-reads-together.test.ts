import { beforeEach, describe, expect, it, vi } from "vitest";

/** PERF-4: the items read and the placement read start together; the joined result is what it was. */
const started: string[] = [];
const resolvers: Record<string, (value: unknown) => void> = {};

function deferred(table: string) {
  started.push(table);
  return new Promise((resolve) => {
    resolvers[table] = resolve;
  });
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      if (table === "work_items") {
        return { select: () => ({ eq: () => ({ order: () => deferred("work_items") }) }) };
      }
      return { select: () => deferred(table) };
    },
  },
}));

const { fetchWorkItems } = await import("@/hooks/use-work-items");

const item = (id: string) => ({ id, owner_id: "p1", title: id, meta: null, source_meta: null });

beforeEach(() => {
  started.length = 0;
  for (const key of Object.keys(resolvers)) delete resolvers[key];
});

describe("fetchWorkItems", () => {
  it("starts the placement read without waiting for the items read", async () => {
    const pending = fetchWorkItems("o1");
    await Promise.resolve();
    expect(started).toEqual(["work_items", "work_item_tasks"]);
    resolvers["work_item_tasks"]!({
      data: [
        { work_item_id: "a", task_id: "t1", tasks: { id: "t1", name: "Scope" } },
        { work_item_id: "elsewhere", task_id: "t2", tasks: { id: "t2", name: "Other workspace" } },
      ],
      error: null,
    });
    resolvers["work_items"]!({ data: [item("a"), item("b")], error: null });
    const result = await pending;
    expect(result.mappingError).toBeNull();
    expect(result.items.map((row) => [row.id, row.work_item_tasks.map((t) => t.task_id)])).toEqual([
      ["a", ["t1"]],
      ["b", []],
    ]);
  });

  it("still shows the work when the placement read fails", async () => {
    const pending = fetchWorkItems("o1");
    await Promise.resolve();
    resolvers["work_items"]!({ data: [item("a")], error: null });
    resolvers["work_item_tasks"]!({ data: null, error: { message: "denied" } });
    const result = await pending;
    expect(result.items).toHaveLength(1);
    expect(result.mappingError).toBe("denied");
  });

  it("fails when the items read fails, whatever the placements say", async () => {
    const pending = fetchWorkItems("o1");
    await Promise.resolve();
    resolvers["work_item_tasks"]!({ data: [], error: null });
    resolvers["work_items"]!({ data: null, error: new Error("items failed") });
    await expect(pending).rejects.toThrow("items failed");
  });

  it("returns no placement error for an empty workspace", async () => {
    const pending = fetchWorkItems("o1");
    await Promise.resolve();
    resolvers["work_items"]!({ data: [], error: null });
    resolvers["work_item_tasks"]!({ data: null, error: { message: "denied" } });
    expect(await pending).toEqual({ items: [], mappingError: null });
  });
});
