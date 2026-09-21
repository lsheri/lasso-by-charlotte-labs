import { describe, expect, it } from "vitest";
import { TRAIL_FRAME_ID, TRAIL_SIZE, boardHasTrail, isTrailFrameId, trailRectAt } from "@/lib/reasoning-trail";
import { isContextFrameId, isWorkstreamFrameId } from "@/lib/context-region";
import { boardHasSeededStructure } from "@/components/canvas-lab/canvas-lab-model";
import { splitClaims } from "@/lib/workstream-draw";

describe("B3 reasoning trail", () => {
  it("places the trail where the person asked for it", () => {
    const rect = trailRectAt({ x: 133, y: 207 });
    expect(rect.width).toBe(TRAIL_SIZE.width);
    expect(rect.height).toBe(TRAIL_SIZE.height);
    expect(rect.x % 8).toBe(0);
    expect(rect.y % 8).toBe(0);
  });

  it("offers the control only while the board has no trail", () => {
    expect(boardHasTrail([{ id: "task:1" }])).toBe(false);
    expect(boardHasTrail([{ id: "task:1" }, { id: TRAIL_FRAME_ID }])).toBe(true);
  });

  it("is neither a workstream nor the context region", () => {
    expect(isTrailFrameId(TRAIL_FRAME_ID)).toBe(true);
    expect(isWorkstreamFrameId(TRAIL_FRAME_ID)).toBe(false);
    expect(isContextFrameId(TRAIL_FRAME_ID)).toBe(false);
    expect(isWorkstreamFrameId("task:1")).toBe(true);
  });

  it("does not make a blank board read as seeded", () => {
    expect(boardHasSeededStructure({ frames: [{ kind: "custom", key: TRAIL_FRAME_ID }] })).toBe(false);
    expect(boardHasSeededStructure({ frames: [{ kind: "custom", key: "custom:1" }] })).toBe(true);
  });

  it("a drawn workstream over the trail claims nothing of it", () => {
    const card = { id: "n1", x: 40, y: 40, width: 200, height: 120, frame: TRAIL_FRAME_ID, workItemId: "w1" };
    const claims = splitClaims({ x: 0, y: 0, width: 800, height: 600 }, [card] as never, {
      isWorkstreamFrame: (id: string | null) => isWorkstreamFrameId(id),
    } as never);
    expect(claims.silent.length + claims.ask.length).toBe(0);
  });
});
