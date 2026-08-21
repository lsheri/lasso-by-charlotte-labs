import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  announceGrab,
  announceMove,
  correctSameColumn,
  indexByMidpoint,
  keyboardTarget,
  moveCard,
  samePos,
  type MoveColumn,
} from "@/lib/canvas-move";
import { persistOrder, remapItems, resetOrder } from "@/lib/workflow-order";

function board(): MoveColumn[] {
  return [
    { id: "t1", name: "Discovery", cardIds: ["a", "b", "c"] },
    { id: "t2", name: "Build", cardIds: ["d"] },
  ];
}

/** A Supabase-shaped stub that records the calls the canvas makes. */
function stubClient(calls: unknown[]) {
  const chain = (table: string) => {
    const record: Record<string, unknown> = { table };
    const api: Record<string, unknown> = {};
    for (const key of ["update", "insert", "delete", "eq", "in"]) {
      api[key] = (...args: unknown[]) => {
        record[key] = args.length === 1 ? args[0] : args;
        if (key === "insert" || key === "update") record["op"] = key;
        return api;
      };
    }
    (api as { then: unknown }).then = (resolve: (v: unknown) => unknown) => {
      calls.push(record);
      return Promise.resolve(resolve({ error: null }));
    };
    return api;
  };
  return { from: (table: string) => chain(table) } as never;
}

describe("canvas moves", () => {
  it("moves a card within a column", () => {
    const { cols, pos } = moveCard(board(), { col: 0, index: 0 }, { col: 0, index: 2 });
    expect(cols[0]!.cardIds).toEqual(["b", "c", "a"]);
    expect(pos).toEqual({ col: 0, index: 2 });
  });

  it("moves a card across columns and clamps the index", () => {
    const { cols, pos } = moveCard(board(), { col: 0, index: 1 }, { col: 1, index: 9 });
    expect(cols[0]!.cardIds).toEqual(["a", "c"]);
    expect(cols[1]!.cardIds).toEqual(["d", "b"]);
    expect(pos).toEqual({ col: 1, index: 1 });
  });

  it("is a no-op for an unknown position", () => {
    const start = board();
    expect(moveCard(start, { col: 4, index: 0 }, { col: 0, index: 0 }).cols).toBe(start);
  });

  it("reads an insert index from card midpoints", () => {
    expect(indexByMidpoint([50, 150, 250], 10)).toBe(0);
    expect(indexByMidpoint([50, 150, 250], 160)).toBe(2);
    expect(indexByMidpoint([50, 150, 250], 900)).toBe(3);
  });

  it("accounts for the card leaving its own column", () => {
    expect(correctSameColumn({ col: 0, index: 0 }, { col: 0, index: 2 })).toEqual({
      col: 0,
      index: 1,
    });
    expect(correctSameColumn({ col: 0, index: 2 }, { col: 1, index: 2 })).toEqual({
      col: 1,
      index: 2,
    });
  });

  it("resolves arrow keys the same way a drag would", () => {
    const cols = board();
    expect(keyboardTarget(cols, { col: 0, index: 0 }, "ArrowUp")).toBeNull();
    expect(keyboardTarget(cols, { col: 0, index: 0 }, "ArrowDown")).toEqual({ col: 0, index: 1 });
    expect(keyboardTarget(cols, { col: 0, index: 2 }, "ArrowRight")).toEqual({ col: 1, index: 1 });
    expect(keyboardTarget(cols, { col: 1, index: 0 }, "ArrowRight")).toBeNull();
    expect(keyboardTarget(cols, { col: 0, index: 0 }, "Tab")).toBeNull();
  });

  it("announces in sentences, never coordinates", () => {
    expect(announceGrab("Pricing memo")).toBe("Pricing memo picked up");
    expect(announceMove("Pricing memo", "Build", 1)).toBe(
      "Pricing memo moved to Build, position 2",
    );
    expect(samePos({ col: 1, index: 1 }, { col: 1, index: 1 })).toBe(true);
  });
});

describe("shared write helpers keep the list behaviour", () => {
  it("persistOrder writes one confirmed step per item, in order", async () => {
    const calls: unknown[] = [];
    const onChanged = vi.fn();
    const result = await persistOrder({
      client: stubClient(calls),
      taskId: "t1",
      workItemIds: ["a", "b"],
      orgId: undefined,
      onChanged,
    });
    expect(result.error).toBeNull();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ table: "work_item_tasks", update: { step_no: 1, step_confirmed: true } });
    expect(calls[1]).toMatchObject({ update: { step_no: 2, step_confirmed: true } });
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("resetOrder clears the confirmation for the whole workstream", async () => {
    const calls: unknown[] = [];
    const onChanged = vi.fn();
    const result = await resetOrder({
      client: stubClient(calls),
      taskId: "t1",
      orgId: undefined,
      onChanged,
    });
    expect(result.error).toBeNull();
    expect(calls[0]).toMatchObject({
      table: "work_item_tasks",
      update: { step_no: null, step_confirmed: false },
    });
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("remapItems removes the old link before writing the new one", async () => {
    const calls: { table: string; op?: string }[] = [];
    const detachEpisode = vi.fn().mockResolvedValue(null);
    const syncEpisode = vi.fn().mockResolvedValue(null);
    const result = await remapItems({
      client: stubClient(calls as unknown[]),
      targets: [{ id: "a", type: "doc", source: "drive" }],
      taskId: "t2",
      profile: { id: "p1", org_id: "o1" },
      detachEpisode,
      syncEpisode,
      invalidate: vi.fn(),
    });
    expect(result.error).toBeNull();
    expect(calls.map((c) => c.op ?? "delete")).toEqual(["delete", "insert", "update"]);
    expect(detachEpisode).toHaveBeenCalledBefore(syncEpisode);
  });
});


/**
 * The pointer path is component state (refs, window listeners), not pure logic,
 * so it cannot be exercised without a DOM harness. What is asserted here is the
 * shape the recheck required; the gesture outcomes themselves were traced by
 * hand: mouse down then 8px lifts and drops without peeking, a still tap peeks,
 * a long press opens the sheet only, and a release outside the canvas ends it.
 */
describe("canvas pointer wiring", () => {
  const source = readFileSync("src/components/engagements/EngagementCanvas.tsx", "utf8");

  it("lifts a mouse drag once movement passes the slop", () => {
    expect(source).toMatch(/if \(Math\.hypot\(dx, dy\) < SLOP\) return;\s*\n\s*lift\(start,/);
  });

  it("guards the click with a moved ref rather than the cleared start ref", () => {
    expect(source).toContain("if (movedRef.current) {");
    expect(source).not.toContain("!startRef.current?.lifted");
  });

  it("tracks the drag on the window, not on the scroll container", () => {
    expect(source).toContain('window.addEventListener("pointermove", onMove, { passive: false })');
    expect(source).toContain('window.addEventListener("pointerup", onUp)');
    expect(source).toContain('window.addEventListener("pointercancel", onCancel)');
    expect(source).not.toContain("onPointerMove={movePointer}");
  });

  it("keeps the shared write helpers as the only write path", () => {
    expect(source).toContain("persistOrder(");
    expect(source).toContain("remapItems(");
    expect(source).toContain("resetOrder(");
  });
});
