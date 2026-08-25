import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { DELETE_PERMANENCE_LINE } from "@/components/work/DeleteWorkItemDialog";
import { invalidateAfterWorkChange, WORK_CHANGE_KEYS } from "@/lib/work-invalidation";
import { ownsWorkItem } from "@/lib/work-ownership";
import {
  deleteWorkItemRow,
  removeFromEngagement,
  type CallerClient,
} from "@/lib/work-remove.server";

type Row = Record<string, unknown>;

/**
 * A Supabase-shaped stub over in-memory tables, faithful to the two filters the
 * remove path uses (eq and in) and recording every write.
 */
function stubClient(tables: Record<string, Row[]>, calls: Row[] = []) {
  function builder(table: string) {
    const eqs: [string, unknown][] = [];
    const ins: [string, unknown[]][] = [];
    let op: "select" | "delete" | "update" = "select";
    let patch: Row | null = null;

    const match = (row: Row) =>
      eqs.every(([col, value]) => row[col] === value) &&
      ins.every(([col, values]) => values.includes(row[col]));

    const run = () => {
      const rows = tables[table] ?? [];
      if (op === "delete") {
        calls.push({ table, op: "delete", eqs: [...eqs], ins: [...ins] });
        tables[table] = rows.filter((row) => !match(row));
        return { data: null, error: null };
      }
      if (op === "update") {
        calls.push({ table, op: "update", patch, eqs: [...eqs] });
        for (const row of rows) if (match(row)) Object.assign(row, patch);
        return { data: null, error: null };
      }
      return { data: rows.filter(match), error: null };
    };

    const api: Record<string, unknown> = {
      select: () => api,
      order: () => api,
      delete: () => {
        op = "delete";
        return api;
      },
      update: (next: Row) => {
        op = "update";
        patch = next;
        return api;
      },
      eq: (col: string, value: unknown) => {
        eqs.push([col, value]);
        return api;
      },
      in: (col: string, values: unknown[]) => {
        ins.push([col, values]);
        return api;
      },
      maybeSingle: () => {
        const result = run() as { data: Row[] | null };
        return Promise.resolve({ data: result.data?.[0] ?? null, error: null });
      },
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(run())),
    };
    return api;
  }
  return { from: (table: string) => builder(table), calls } as unknown as CallerClient & {
    calls: Row[];
  };
}

function world(): Record<string, Row[]> & { work_items: Row[]; work_item_tasks: Row[]; tasks: Row[] } {
  return {
    work_items: [
      { id: "w1", owner_id: "p1", content_ref: "org/w1.pdf", meta: { text_ref: "org/w1.txt" }, visibility: "mapped" },
    ],
    tasks: [
      { id: "t1", engagement_id: "e1" },
      { id: "t2", engagement_id: "e2" },
    ],
    work_item_tasks: [
      { work_item_id: "w1", task_id: "t1", step_no: 1, step_confirmed: true },
      { work_item_id: "w1", task_id: "t2", step_no: 1, step_confirmed: true },
      { work_item_id: "w2", task_id: "t1", step_no: 2, step_confirmed: true },
    ],
  };
}

describe("remove from engagement", () => {
  it("unpicks only this engagement's mapping rows", async () => {
    const tables = world();
    const client = stubClient(tables as never);
    const result = await removeFromEngagement(client, {
      workItemId: "w1",
      engagementId: "e1",
      profileId: "p1",
    });
    expect(result).toEqual({ removed: 1, still_mapped_elsewhere: true });
    expect(tables.work_item_tasks).toEqual([
      { work_item_id: "w1", task_id: "t2", step_no: 1, step_confirmed: true },
      { work_item_id: "w2", task_id: "t1", step_no: 1, step_confirmed: true },
    ]);
    // Still mapped elsewhere, so it does not return to the pile.
    expect(tables.work_items[0]!.visibility).toBe("mapped");
  });

  it("returns the item to the pile once nothing maps it", async () => {
    const tables = world();
    tables.work_item_tasks = tables.work_item_tasks.filter((row) => row.task_id !== "t2");
    const client = stubClient(tables as never);
    const result = await removeFromEngagement(client, {
      workItemId: "w1",
      engagementId: "e1",
      profileId: "p1",
    });
    expect(result.still_mapped_elsewhere).toBe(false);
    expect(tables.work_items[0]!.visibility).toBe("unmapped");
  });

  it("clears a brief marker scoped to the engagement it just left", async () => {
    const tables = world();
    tables.work_items[0]!.meta = { role: "brief", brief_scope: { type: "engagement", id: "e1" } };
    const client = stubClient(tables as never);
    await removeFromEngagement(client, {
      workItemId: "w1",
      engagementId: "e1",
      profileId: "p1",
    });
    expect(tables.work_items[0]!.meta).toEqual({});
  });

  it("refuses a caller who does not own the item", async () => {
    const client = stubClient(world() as never);
    await expect(
      removeFromEngagement(client, { workItemId: "w1", engagementId: "e1", profileId: "someone" }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("delete work item", () => {
  function admin(tables: ReturnType<typeof world>, remove: (paths: string[]) => Promise<unknown>) {
    const client = stubClient(tables as never);
    return {
      storage: { from: () => ({ remove }) },
      from: client.from,
    } as never;
  }

  it("removes both stored refs and then the row", async () => {
    const tables = world();
    const remove = vi.fn(async () => ({ error: null }));
    const client = stubClient(tables as never);
    const result = await deleteWorkItemRow(client, admin(tables, remove), {
      workItemId: "w1",
      profileId: "p1",
    });
    expect(remove).toHaveBeenCalledWith(["org/w1.pdf", "org/w1.txt"]);
    expect(result).toEqual({ deleted: true, objects: 2 });
    expect(tables.work_items).toEqual([]);
  });

  it("tolerates storage objects that are already gone", async () => {
    const tables = world();
    const remove = vi.fn(async () => {
      throw new Error("Object not found");
    });
    const client = stubClient(tables as never);
    await expect(
      deleteWorkItemRow(client, admin(tables, remove), { workItemId: "w1", profileId: "p1" }),
    ).resolves.toEqual({ deleted: true, objects: 2 });
    expect(tables.work_items).toEqual([]);
  });

  it("refuses a non-owner with a 403", async () => {
    const tables = world();
    const client = stubClient(tables as never);
    await expect(
      deleteWorkItemRow(client, admin(tables, async () => null), {
        workItemId: "w1",
        profileId: "other",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(tables.work_items).toHaveLength(1);
  });
});

describe("who may remove or delete", () => {
  it("never a coach, never another member", () => {
    expect(ownsWorkItem({ id: "p1", role: "em" }, { owner_id: "p1" })).toBe(true);
    expect(ownsWorkItem({ id: "p1", role: "coach" }, { owner_id: "p1" })).toBe(false);
    expect(ownsWorkItem({ id: "p2", role: "em" }, { owner_id: "p1" })).toBe(false);
    expect(ownsWorkItem(null, { owner_id: "p1" })).toBe(false);
  });

  it("gates every affordance on that one predicate", () => {
    for (const file of [
      "components/work/RowMenu.tsx",
      "components/engagements/EngagementCanvas.tsx",
    ]) {
      expect(readFileSync(join(process.cwd(), "src", file), "utf8")).toContain("ownsWorkItem(");
    }
  });
});

describe("copy and freshness", () => {
  it("states the permanence plainly", () => {
    expect(DELETE_PERMANENCE_LINE).toContain("This cannot be undone.");
    expect(DELETE_PERMANENCE_LINE).toContain("transcript turns");
    const source = readFileSync(
      join(process.cwd(), "src/components/work/DeleteWorkItemDialog.tsx"),
      "utf8",
    );
    expect(source).toContain("{DELETE_PERMANENCE_LINE}");
  });

  it("invalidates every list, count and per-item cache", async () => {
    const invalidateQueries = vi.fn(async (_args: { queryKey: unknown[] }) => undefined);
    await invalidateAfterWorkChange({ invalidateQueries } as never, "w1");
    const keys = invalidateQueries.mock.calls.map((call) => call[0].queryKey);
    for (const key of WORK_CHANGE_KEYS) expect(keys).toContainEqual([...key]);
    for (const key of [
      ["span-audit", "w1"],
      ["span-audit-rendition", "w1"],
      ["ai-reads", "w1"],
      ["turns", "w1"],
    ]) {
      expect(keys).toContainEqual(key);
    }
  });
});
