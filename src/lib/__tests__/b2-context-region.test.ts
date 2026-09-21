import { describe, expect, it } from "vitest";

import {
  CONTEXT_FRAME_ID,
  contextExitPoint,
  contextRegionAround,
  contextRegionFor,
  contextSlots,
  isContextFrameId,
  isWorkstreamFrameId,
  needsContextRegion,
  overlapsContextRegion,
} from "../context-region";
import { splitClaims } from "../workstream-draw";
import { nextWorkstreamRect, workstreamAddAnchor, boardHasSeededStructure } from "@/components/canvas-lab/canvas-lab-model";

const card = { width: 232, height: 112 };

describe("the context region", () => {
  it("is made only when there is a brief or a document", () => {
    expect(needsContextRegion({ hasBrief: false, fileCount: 0 })).toBe(false);
    expect(needsContextRegion({ hasBrief: true, fileCount: 0 })).toBe(true);
    expect(needsContextRegion({ hasBrief: false, fileCount: 2 })).toBe(true);
  });

  it("wraps the brief where it already stands, so making it moves nothing", () => {
    const brief = { x: 220, y: 154, ...card };
    const rect = contextRegionAround(brief, 2);
    expect(rect.x).toBeLessThanOrEqual(brief.x);
    expect(rect.y).toBeLessThanOrEqual(brief.y);
    expect(rect.x + rect.width).toBeGreaterThanOrEqual(brief.x + brief.width);
  });

  it("gives free places inside itself and never on top of a card already there", () => {
    const rect = contextRegionAround({ x: 0, y: 0, ...card }, 3);
    const first = contextSlots(rect, [], 1)[0];
    expect(first).toBeDefined();
    const next = contextSlots(rect, [{ ...(first as { x: number; y: number }), ...card }], 2);
    expect(next).toHaveLength(2);
    for (const point of next) {
      expect(point.x === first?.x && point.y === first?.y).toBe(false);
    }
  });

  it("grows downwards to keep its cards inside", () => {
    const rect = contextRegionAround({ x: 0, y: 0, ...card }, 1);
    const grown = contextRegionFor(rect, [{ x: rect.x + 20, y: rect.y + 900, ...card }]);
    expect(grown.height).toBeGreaterThan(rect.height);
    expect(grown.x).toBe(rect.x);
  });

  it("puts a card taken out of context below the region, clear of everything", () => {
    const rect = contextRegionAround({ x: 0, y: 0, ...card }, 1);
    const at = contextExitPoint(rect, [{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }]);
    expect(at.y).toBeGreaterThanOrEqual(rect.y + rect.height);
  });
});

describe("the context region is not a workstream", () => {
  it("is never counted as one", () => {
    expect(isContextFrameId(CONTEXT_FRAME_ID)).toBe(true);
    expect(isWorkstreamFrameId(CONTEXT_FRAME_ID)).toBe(false);
    expect(isWorkstreamFrameId("task:a")).toBe(true);
    expect(isWorkstreamFrameId("custom:a")).toBe(true);
    expect(isWorkstreamFrameId(null)).toBe(false);
  });

  it("keeps its cards when a workstream box is drawn over it", () => {
    const rect = { x: 0, y: 0, width: 900, height: 900 };
    const split = splitClaims(rect, [
      { id: "brief", x: 20, y: 20, ...card, frame: CONTEXT_FRAME_ID },
      { id: "doc", x: 20, y: 200, ...card, frame: CONTEXT_FRAME_ID, workItemId: "w1" },
      { id: "loose", x: 400, y: 200, ...card, frame: null, workItemId: "w2" },
    ]);
    expect(split.silent.map((entry) => entry.id)).toEqual(["loose"]);
    expect(split.ask).toEqual([]);
    expect(split.frameOnly).toEqual([]);
  });

  it("is skipped by the workstream row and the next workstream place", () => {
    const frames = [
      { id: CONTEXT_FRAME_ID, name: "Context", x: 0, y: 0, width: 560, height: 300 },
      { id: "task:a", name: "A", x: 900, y: 500, width: 320, height: 260 },
    ];
    expect(workstreamAddAnchor(frames, [])?.x).toBe(900);
    expect(nextWorkstreamRect(frames, []).x).toBe(900);
  });

  it("does not make a blank board read as seeded", () => {
    expect(boardHasSeededStructure({ frames: [{ kind: "context" }] })).toBe(false);
    expect(boardHasSeededStructure({ frames: [{ kind: "context" }, { kind: "task" }] })).toBe(true);
    expect(boardHasSeededStructure({ frames: [] })).toBe(false);
  });
});

describe("the region encloses context only", () => {
  it("spots an unrelated card sitting under the region", () => {
    const rect = contextRegionAround({ x: 0, y: 0, ...card }, 1);
    expect(overlapsContextRegion(rect, { x: rect.x + 20, y: rect.y + 20, ...card })).toBe(true);
    expect(overlapsContextRegion(rect, { x: rect.x, y: rect.y + rect.height + 40, ...card })).toBe(false);
  });

  it("sends that card clear of the region, below it", () => {
    const rect = contextRegionAround({ x: 0, y: 0, ...card }, 1);
    const at = contextExitPoint(rect, [rect]);
    expect(overlapsContextRegion(rect, { ...at, ...card })).toBe(false);
  });
});
