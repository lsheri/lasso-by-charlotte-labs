import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { boxRemoval, canDeleteWorkstreamFromBoard, canManageWorkstream, regionNameAction, BOARD_WORKSTREAM_COPY } from "@/lib/board-workstream-delete";
import { deleteWorkstreamRow, WORKSTREAM_IS_DEFAULT, WORKSTREAM_NOT_EMPTY } from "@/lib/workstreams.server";
import { validateFrameArchive } from "@/lib/canvas-lab.server";

const owner = { id: "p1", role: "em" };
const other = { id: "p2", role: "em" };
const coach = { id: "p1", role: "coach" };
const empty = { id: "t1", owner_id: "p1", is_board_default: false, work_item_tasks: [] };
const holding = { ...empty, work_item_tasks: [{ work_item_id: "w1" }] };
const fallback = { ...empty, id: "t0", is_board_default: true };

function fakeClient(task: Record<string, unknown> | null, links: { work_item_id: string }[]) {
  const deletes: string[] = [];
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      let op = "select";
      let id = "";
      chain["select"] = () => chain;
      chain["update"] = () => { op = "update"; return chain; };
      chain["delete"] = () => { op = "delete"; return chain; };
      chain["in"] = () => Promise.resolve({ data: [], error: null });
      chain["eq"] = (_c: string, v: string) => {
        id = v;
        if (op === "delete") { deletes.push(`${table}:${id}`); return Promise.resolve({ error: null }); }
        if (table === "work_item_tasks") return Promise.resolve({ data: op === "select" && deletes.length ? [] : links, error: null });
        if (op === "update") return Promise.resolve({ error: null });
        return chain;
      };
      chain["maybeSingle"] = () => Promise.resolve({ data: task, error: null });
      return chain;
    },
  };
  return { client: client as never, deletes };
}

describe("WK1 renaming reuses the workstream", () => {
  it("a region with a workstream renames it, and creates nothing", () => {
    expect(regionNameAction({ clearing: false, taskId: "t1", task: empty, profile: owner, cardsInBox: 0 })).toEqual({ action: "rename", taskId: "t1" });
  });
  it("a region without one creates one", () => {
    expect(regionNameAction({ clearing: false, taskId: null, task: null, profile: owner, cardsInBox: 0 })).toEqual({ action: "create" });
  });
  it("the board calls the existing rename on that path, never create", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const body = page.slice(page.indexOf("async function changeRegionName"), page.indexOf("function frameRemoval"));
    expect(body).toContain('if (nameAction.action === "rename")');
    expect(body).toMatch(/renameWorkstreamCall\(\{ data: \{ task_id: nameAction\.taskId/);
    expect(body.indexOf("renameWorkstreamCall")).toBeLessThan(body.indexOf("createDrawnWorkstream("));
  });
});

describe("WK1 clearing a name", () => {
  it("an empty workstream is removed", () => {
    expect(regionNameAction({ clearing: true, taskId: "t1", task: empty, profile: owner, cardsInBox: 0 })).toEqual({ action: "clear_and_delete", taskId: "t1" });
  });
  it("mapped work keeps the workstream and the name, and says why", () => {
    expect(regionNameAction({ clearing: true, taskId: "t1", task: holding, profile: owner, cardsInBox: 0 })).toEqual({ action: "refuse_clear" });
    expect(regionNameAction({ clearing: true, taskId: "t1", task: empty, profile: owner, cardsInBox: 2 })).toEqual({ action: "refuse_clear" });
    expect(BOARD_WORKSTREAM_COPY.clearRefused).toBe("This workstream still holds work, so its name stays.");
  });
  it("never deletes the default", () => {
    expect(regionNameAction({ clearing: true, taskId: "t0", task: fallback, profile: owner, cardsInBox: 0 }).action).toBe("clear");
  });
});

describe("WK1 removing a box", () => {
  it("an empty owned workstream box offers delete", () => {
    expect(boxRemoval({ custom: true, seeded: false, profile: owner, task: empty, cardsInBox: 0 })).toEqual({ offer: "workstream", removable: true });
    expect(boxRemoval({ custom: false, seeded: true, profile: owner, task: empty, cardsInBox: 0 })).toEqual({ offer: "workstream", removable: true });
  });
  it("a workstream holding work is refused", () => {
    expect(boxRemoval({ custom: true, seeded: false, profile: owner, task: holding, cardsInBox: 0 })).toEqual({ offer: "workstream", removable: false });
    expect(canDeleteWorkstreamFromBoard({ profile: owner, task: holding, cardsInBox: 0 })).toBe(false);
  });
  it("a non-owner and a coach cannot delete", () => {
    expect(canManageWorkstream(other, empty)).toBe(false);
    expect(canManageWorkstream(coach, empty)).toBe(false);
    expect(canDeleteWorkstreamFromBoard({ profile: other, task: empty, cardsInBox: 0 })).toBe(false);
    expect(canDeleteWorkstreamFromBoard({ profile: coach, task: empty, cardsInBox: 0 })).toBe(false);
    // WK2: somebody else's workstream box is no longer removable at all.
    expect(boxRemoval({ custom: true, seeded: false, profile: other, task: empty, cardsInBox: 0 }).offer).toBe("none");
    expect(boxRemoval({ custom: false, seeded: true, profile: coach, task: empty, cardsInBox: 0 }).offer).toBe("none");
  });
  it("the default is never deletable from the board", () => {
    expect(canDeleteWorkstreamFromBoard({ profile: owner, task: fallback, cardsInBox: 0 })).toBe(false);
    expect(boxRemoval({ custom: false, seeded: true, profile: owner, task: fallback, cardsInBox: 0 }).offer).toBe("none");
  });
  it("the server lets a task-backed box come off and keeps every other refusal", () => {
    expect(validateFrameArchive("task", 0, true)).toBeNull();
    expect(validateFrameArchive("task", 0)).toBe("Only a custom workstream can be removed.");
    expect(validateFrameArchive("task", 1, true)).toBe("Move its cards first.");
    expect(validateFrameArchive("decisions", 0, true)).toBe("Only a custom workstream can be removed.");
  });
});

describe("WK1 the existing delete path", () => {
  it("deletes an empty workstream", async () => {
    const { client, deletes } = fakeClient({ id: "t1", engagement_id: "e1", is_board_default: false }, []);
    await expect(deleteWorkstreamRow(client, { taskId: "t1", requireEmpty: true })).resolves.toMatchObject({ deleted: true });
    expect(deletes).toEqual(["tasks:t1"]);
  });
  it("refuses one holding work when asked to require empty", async () => {
    const { client, deletes } = fakeClient({ id: "t1", engagement_id: "e1", is_board_default: false }, [{ work_item_id: "w1" }]);
    await expect(deleteWorkstreamRow(client, { taskId: "t1", requireEmpty: true })).rejects.toThrow(WORKSTREAM_NOT_EMPTY);
    expect(deletes).toEqual([]);
  });
  it("never deletes the default, from any caller", async () => {
    const { client, deletes } = fakeClient({ id: "t0", engagement_id: "e1", is_board_default: true }, []);
    await expect(deleteWorkstreamRow(client, { taskId: "t0" })).rejects.toThrow(WORKSTREAM_IS_DEFAULT);
    expect(deletes).toEqual([]);
  });
  it("the board sends require_empty through the same server function", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain('from "@/lib/workstreams.functions"');
    expect(page.match(/require_empty: true/g)?.length).toBe(2);
    vi.restoreAllMocks();
  });
});
