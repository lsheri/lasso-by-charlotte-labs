import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  applyDurableBoard,
  boardFrameRenders,
  boardHasSeededStructure,
  frameKindOf,
  materializableFrames,
  savedBoxLabFrames,
  type LabFrame,
} from "@/components/canvas-lab/canvas-lab-model";
import { isContextFrameId } from "@/lib/context-region";

const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
const shared = readFileSync("src/components/canvas-lab/SharedBoardView.tsx", "utf8");

const tasks = [
  { id: "t1", name: "Revenue" },
  { id: "t2", name: "Company Research" },
  { id: "t3", name: "Pricing" },
];
let ord = 0;
const row = (key: string, kind: string, label: string | null, extra: Record<string, unknown> = {}) => ({
  id: `row-${key}`, key, kind, label, fill: null, x: 10, y: 10, w: 300, h: 200, ord: ord++, version: 1, ...extra,
});
const board = (frames: ReturnType<typeof row>[]) => ({ id: "b1", frames, nodes: [], links: [], relationships: [], canEditStructure: true, viewerProfileId: "p1" }) as never;
const isWorkstreamBox = (frame: LabFrame) => frame.id.startsWith("task:") || frame.id === "workstreams";
const rendered = (b: never) => {
  const base = boardHasSeededStructure(b) ? savedBoxLabFrames(tasks, b) : [];
  return applyDurableBoard({ frames: base, nodes: [] }, b).frames.filter((frame) => boardFrameRenders(frameKindOf(frame), true));
};
const moveChoices = (frames: LabFrame[]) =>
  frames.filter((frame) => !isContextFrameId(frame.id) && frame.id !== "trail" && boardFrameRenders(frameKindOf(frame), true)).map((frame) => frame.id);

describe("WK3 a workstream gets a box only if someone drew one", () => {
  it("three workstreams and no saved rows render no workstream boxes, before and after naming a region", () => {
    expect(rendered(board([])).filter(isWorkstreamBox)).toEqual([]);
    const named = board([row("region:a", "custom", "Company Research", { task_id: "t2" })]);
    expect(rendered(named).filter(isWorkstreamBox)).toEqual([]);
  });

  it("naming one region does not make boxes appear for the other workstreams", () => {
    const named = board([row("region:a", "custom", "Company Research", { task_id: "t2" })]);
    const names = rendered(named).map((frame) => frame.name);
    expect(names).not.toContain("Revenue");
    expect(names).not.toContain("Pricing");
  });

  it("a named region renders once, not twice", () => {
    const named = board([row("region:a", "custom", "Company Research", { task_id: "t2" })]);
    expect(rendered(named).filter((frame) => frame.name === "Company Research")).toHaveLength(1);
  });

  it("a saved task: row keeps its own name, its task kind, and its saved id", () => {
    const old = board([row("task:t1", "task", null, { task_id: "t1" })]);
    const box = rendered(old).find((frame) => frame.durableId === "row-task:t1");
    expect(box?.id).toBe("task:t1");
    expect(box?.name).toBe("Revenue");
    expect(frameKindOf(box!)).toBe("task");
    // Only the saved one: the other two workstreams stay boxless.
    expect(rendered(old).filter((frame) => frame.id.startsWith("task:")).map((frame) => frame.id)).toEqual(["task:t1"]);
  });

  it("a workstream with no box is absent from the move-to list, and one with a box is present", () => {
    const old = board([row("task:t1", "task", null, { task_id: "t1" }), row("region:a", "custom", "Company Research", { task_id: "t2" })]);
    const choices = moveChoices(rendered(old));
    expect(choices).toContain("task:t1");
    expect(choices).toContain("region:a");
    expect(choices).not.toContain("task:t2");
    expect(choices).not.toContain("task:t3");
  });

  it("materialize never sends a generated task: frame", () => {
    const generated = { id: "task:t3", name: "Pricing", x: 0, y: 0, width: 1, height: 1 } as LabFrame;
    const saved = { ...generated, id: "task:t1", durableId: "row-1" } as LabFrame;
    const drawnRegion = { ...generated, id: "region:z" } as LabFrame;
    expect(materializableFrames([generated, saved, drawnRegion]).map((frame) => frame.id)).toEqual(["task:t1", "region:z"]);
    expect(page).toContain("materializableFrames(framesRef.current).map(");
  });

  it("both board views build seeded frames from saved rows only", () => {
    expect(page).toContain("savedBoxLabFrames(boardTasks, lab.board)");
    expect(shared).toContain("savedBoxLabFrames(dto.seed.tasks, board)");
    expect(page).not.toContain("createLabFrames(boardTasks)");
  });
});
