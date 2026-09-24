import { describe, expect, it } from "vitest";

import {
  applyDurableBoard,
  boardHasSeededStructure,
  createLabFrames,
  fitWorkboardViewport,
  seedBlankCanvas,
  seedCanvas,
  sizeSeedFrames,
  stageBounds,
  type LabNode,
} from "@/components/canvas-lab/canvas-lab-model";
import { PLACEMENT_GAP, slotIsFree } from "@/lib/workboard-placement";

const SEED = {
  brief: { title: "The brief", text: "What the work is measured against." },
  tasks: [{ id: "t1", name: "Discovery", detail: null, ownedByViewer: true }],
  work: [
    { id: "w1", title: "Kickoff deck", typeLabel: "document", source: "upload", ownedByViewer: true, taskIds: ["t1"], deliverable: false },
    { id: "w2", title: "Final model", typeLabel: "model", source: "upload", ownedByViewer: true, taskIds: [], deliverable: true },
  ],
  decisions: [{ id: "d1", call: "Go with option B", situation: "Two options priced", ownedByViewer: true }],
};

const rect = (node: LabNode) => ({ x: node.x, y: node.y, width: node.width, height: node.height });

describe("which board is which", () => {
  it("reads saved outlines as seeded structure", () => {
    expect(boardHasSeededStructure(null)).toBe(false);
    expect(boardHasSeededStructure({ frames: [] })).toBe(false);
    expect(boardHasSeededStructure({ frames: [{}] })).toBe(true);
  });
});

describe("a new board opens blank", () => {
  it("places every card without an outline, from the origin", () => {
    const nodes = seedBlankCanvas(SEED);
    expect(nodes).toHaveLength(3);
    expect(nodes.every((node) => node.frame === null)).toBe(true);
    expect(nodes[0]).toMatchObject({ id: "work:w1", x: 0, y: 0 });
  });

  it("keeps the same clear space between cards as the rest of the board", () => {
    const nodes = seedBlankCanvas(SEED);
    for (const node of nodes) {
      const others = nodes.filter((other) => other.id !== node.id).map(rect);
      expect(slotIsFree(rect(node), others, PLACEMENT_GAP)).toBe(true);
    }
  });

  it("gives an engagement with nothing on it a usable canvas", () => {
    const empty = seedBlankCanvas({ brief: null, tasks: [], work: [], decisions: [] });
    expect(empty).toHaveLength(0);
    expect(stageBounds([], empty)).toEqual({ width: 980, height: 720 });
    const fitted = fitWorkboardViewport({ width: 1200, height: 760 }, [], empty, new Map(), null);
    expect(fitted.bounds.width).toBeGreaterThan(0);
    expect(fitted.bounds.height).toBeGreaterThan(0);
    expect(Number.isFinite(fitted.zoom)).toBe(true);
    expect(Number.isFinite(fitted.pan.x) && Number.isFinite(fitted.pan.y)).toBe(true);
  });

  it("measures bounds and fit from the cards alone", () => {
    const nodes = seedBlankCanvas(SEED);
    const bounds = stageBounds([], nodes);
    const widest = Math.max(...nodes.map((node) => node.x + node.width));
    expect(bounds.width).toBeGreaterThanOrEqual(widest);
    const fitted = fitWorkboardViewport({ width: 1200, height: 760 }, [], nodes, new Map(), null);
    expect(fitted.bounds.x).toBe(Math.min(...nodes.map((node) => node.x)));
    expect(fitted.bounds.y).toBe(Math.min(...nodes.map((node) => node.y)));
  });
});

describe("S1.2: no brief card on new boards", () => {
  it("seeds no brief node on a new blank or structured board", () => {
    expect(seedBlankCanvas(SEED).some((node) => node.kind === "brief")).toBe(false);
    expect(seedCanvas(SEED).some((node) => node.kind === "brief")).toBe(false);
  });

  it("still renders a brief node the board has saved", () => {
    const base = { frames: [], nodes: seedBlankCanvas({ ...SEED, savedBrief: true }) };
    const board = { frames: [], links: [], viewerProfileId: null, nodes: [{ id: "n1", kind: "brief", title: "", body: "", judgmentType: null, x: 40, y: 40, w: 0, h: 0, frameId: null, workItemId: null, decisionId: null, authorProfileId: null, hidden: false, version: 1 }] } as never;
    const merged = applyDurableBoard(base, board);
    expect(merged.nodes.find((node) => node.id === "brief")).toMatchObject({ kind: "brief", x: 40, width: 360 > 0 ? expect.any(Number) : 0 });
  });
});

describe("a board with structure is untouched", () => {
  it("opens with exactly the arrangement it has today", () => {
    const frames = sizeSeedFrames(createLabFrames([{ id: "t1", name: "Discovery" }]), seedCanvas(SEED, createLabFrames([{ id: "t1", name: "Discovery" }])));
    expect(frames.map((frame) => frame.id)).toEqual(["foundation", "task:t1", "decisions", "outputs"]);
    const nodes = seedCanvas({ ...SEED, savedBrief: true }, frames);
    expect(nodes.map((node) => ({ id: node.id, frame: node.frame, x: node.x, y: node.y }))).toEqual([
      { id: "brief", frame: "foundation", x: 88, y: 484 },
      { id: "work:w1", frame: "task:t1", x: 550, y: 484 },
      { id: "work:w2", frame: "outputs", x: 1474, y: 484 },
      { id: "decision:d1", frame: "decisions", x: 1012, y: 484 },
    ]);
    const fitted = fitWorkboardViewport({ width: 1200, height: 760 }, frames, nodes, new Map());
    expect(fitted.bounds).toEqual({ x: 60, y: 60, width: 1828, height: 880 });
  });
});
