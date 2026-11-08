// MOVE-1: moving a section or workstream saves every position in one request.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { moveMany } from "@/lib/canvas-lab.server";
import { WORKBOARD_MOVE_MANY_MAX } from "@/lib/canvas-lab-shared";
import { commandEntityKind } from "@/hooks/use-canvas-lab";

type Row = Record<string, unknown> & { id: string; version: number };

function fakeDb(tables: Record<string, Row[]>) {
  const writes: { table: string; id: string; patch: Record<string, unknown> }[] = [];
  let requests = 0;
  const db = {
    from(table: string) {
      requests += 1;
      let mode: "select" | "update" = "select";
      let patch: Record<string, unknown> = {};
      const filters: [string, unknown, "eq" | "is" | "in"][] = [];
      const match = (row: Row) => filters.every(([column, value, op]) => (op === "in" ? (value as unknown[]).includes(row[column]) : op === "is" ? (row[column] ?? null) === value : row[column] === value));
      const run = () => {
        const rows = (tables[table] ?? []).filter(match);
        if (mode === "update") {
          for (const row of rows) {
            Object.assign(row, patch);
            row.version += 1;
            writes.push({ table, id: row.id, patch });
          }
          return rows.map((row) => ({ id: row.id, version: row.version }));
        }
        return rows.map((row) => ({ ...row }));
      };
      const builder = {
        select: () => builder,
        update: (next: Record<string, unknown>) => { mode = "update"; patch = next; return builder; },
        eq: (column: string, value: unknown) => { filters.push([column, value, "eq"]); return builder; },
        is: (column: string, value: unknown) => { filters.push([column, value, "is"]); return builder; },
        in: (column: string, value: unknown[]) => { filters.push([column, value, "in"]); return builder; },
        maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
        then: (resolveFn: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data: run(), error: null }).then(resolveFn, reject),
      };
      return builder;
    },
  };
  return { db: db as never, writes, requests: () => requests };
}

const board = { id: "b1", version: 3 };
const tables = () => ({
  workboard_frames: [
    { id: "sec", workboard_id: "b1", deleted_at: null, version: 4, x: 0, y: 0 },
    { id: "ws", workboard_id: "b1", deleted_at: null, version: 2, x: 20, y: 20 },
  ],
  workboard_nodes: [
    { id: "n1", workboard_id: "b1", deleted_at: null, version: 1, kind: "work_item", author_profile_id: "p2", body: null, x: 30, y: 30, w: 240, h: 108 },
    { id: "n2", workboard_id: "b1", deleted_at: null, version: 5, kind: "sticky", author_profile_id: "p2", body: null, x: 60, y: 60, w: 200, h: 140 },
    { id: "j1", workboard_id: "b1", deleted_at: null, version: 1, kind: "judgment", author_profile_id: "p2", body: "x", x: 90, y: 90, w: 240, h: 108 },
  ],
});

describe("MOVE-1 one request for a group move", () => {
  it("moves every frame and card, returns every new version, and writes only the position", async () => {
    const t = tables();
    const { db, writes } = fakeDb(t);
    const result = await moveMany(db, board, "p1", {
      type: "move_many",
      frames: [{ frameId: "sec", expectedVersion: 4, x: 100, y: 50 }, { frameId: "ws", expectedVersion: 2, x: 120, y: 70 }],
      nodes: [{ nodeId: "n1", expectedVersion: 1, x: 130, y: 80 }, { nodeId: "n2", expectedVersion: 5, x: 160, y: 110 }],
    });
    expect(result).toEqual({ status: "saved", boardId: "b1", boardVersion: 3, versions: { sec: 5, ws: 3, n1: 2, n2: 6 } });
    expect(writes).toHaveLength(4);
    for (const write of writes) expect(Object.keys(write.patch).sort()).toEqual(["updated_by", "x", "y"]);
    expect(t.workboard_nodes[1]).toMatchObject({ x: 160, y: 110 });
  });

  it("moves nothing when any one row is stale, and names that row", async () => {
    const { db, writes } = fakeDb(tables());
    const result = await moveMany(db, board, "p1", {
      type: "move_many",
      frames: [{ frameId: "sec", expectedVersion: 4, x: 100, y: 50 }],
      nodes: [{ nodeId: "n1", expectedVersion: 1, x: 130, y: 80 }, { nodeId: "n2", expectedVersion: 4, x: 160, y: 110 }],
    });
    expect(result).toMatchObject({ status: "conflict", entityKind: "node", entityId: "n2", latestVersion: 5 });
    expect(writes).toHaveLength(0);
  });

  it("refuses to move someone else's authored card, and moves nothing", async () => {
    const { db, writes } = fakeDb(tables());
    const result = await moveMany(db, board, "p1", { type: "move_many", frames: [], nodes: [{ nodeId: "n1", expectedVersion: 1, x: 1, y: 1 }, { nodeId: "j1", expectedVersion: 1, x: 2, y: 2 }] });
    expect(result).toEqual({ status: "forbidden" });
    expect(writes).toHaveLength(0);
  });

  it("rejects a move larger than the cap and does nothing for an empty move", async () => {
    const { db, writes } = fakeDb(tables());
    const many = Array.from({ length: WORKBOARD_MOVE_MANY_MAX + 1 }, (_, i) => ({ nodeId: `x${i}`, expectedVersion: 1, x: i, y: i }));
    expect(await moveMany(db, board, "p1", { type: "move_many", frames: [], nodes: many })).toMatchObject({ status: "validation_error" });
    expect(await moveMany(db, board, "p1", { type: "move_many", frames: [], nodes: [] })).toEqual({ status: "saved", boardId: "b1", boardVersion: 3, versions: {} });
    expect(writes).toHaveLength(0);
  });

  it("reports a gone card instead of moving the rest", async () => {
    const { db, writes } = fakeDb(tables());
    const result = await moveMany(db, board, "p1", { type: "move_many", frames: [], nodes: [{ nodeId: "n1", expectedVersion: 1, x: 1, y: 1 }, { nodeId: "missing", expectedVersion: 1, x: 2, y: 2 }] });
    expect(result).toEqual({ status: "validation_error", message: "That card is gone." });
    expect(writes).toHaveLength(0);
  });

  it("files a group move under the node or frame entity for save state and telemetry", () => {
    expect(commandEntityKind({ type: "move_many", frames: [{ frameId: "a", expectedVersion: 1, x: 0, y: 0 }], nodes: [] })).toBe("frame");
    expect(commandEntityKind({ type: "move_many", frames: [], nodes: [{ nodeId: "a", expectedVersion: 1, x: 0, y: 0 }] })).toBe("node");
  });

  it("the board sends one move_many for a finished or cancelled section or workstream drag, never a save per card", () => {
    const page = readFileSync(resolve(process.cwd(), "src/pages/CanvasLabPage.tsx"), "utf8");
    expect(page).toContain('lab.persist({ type: "move_many", ...chunk })');
    expect(page.match(/void persistMoveMany\(/g)?.length).toBe(3);
    expect(page).not.toMatch(/for \(const member of trailDrag\.members\)[\s\S]{0,160}persistNodePatch/);
    expect(page).not.toMatch(/for \(const member of trailDrag\.frameMembers[\s\S]{0,160}persistFramePatch/);
  });
});
