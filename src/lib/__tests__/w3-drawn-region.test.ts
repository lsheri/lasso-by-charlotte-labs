import { describe, expect, it } from "vitest";

import {
  REGION_FILLS,
  filedWorkCount,
  filingPlan,
  isRegionFill,
  isRegionFrameId,
  newRegionFrameId,
  regionClaims,
  regionFrameMove,
  regionIsPaint,
  regionIsWorkstream,
  regionNameChange,
  regionOccupies,
} from "@/lib/board-region";
import { placementRectsForFrames } from "@/lib/workboard-placement";
import type { ClaimCandidate } from "@/lib/workstream-draw";

const RECT = { x: 0, y: 0, width: 400, height: 300 };

function card(id: string, frame: string | null, workItemId: string | null = `item-${id}`): ClaimCandidate {
  return { id, frame, x: 20, y: 20, width: 100, height: 60, workItemId };
}

describe("a drawn region is paint until it is named", () => {
  it("claims nothing while it has no name", () => {
    const region = { id: newRegionFrameId("r1"), label: null, fill: "green-faded" as const };
    expect(isRegionFrameId(region.id)).toBe(true);
    expect(regionIsPaint(region)).toBe(true);
    expect(regionIsWorkstream(region)).toBe(false);
    const inside = card("a", null);
    const split = regionClaims(region, RECT, [inside]);
    expect(split.silent).toHaveLength(0);
    expect(split.ask).toHaveLength(0);
    expect(split.frameOnly).toHaveLength(0);
  });

  it("claims the cards inside on naming and releases them when the name goes", () => {
    const paint = { id: newRegionFrameId("r2"), label: null, fill: "blue-faded" as const };
    const inside = [card("a", null), card("b", null)];
    const named = regionNameChange(paint, "Pricing", RECT, inside);
    expect(named.becomes).toBe("workstream");
    expect(named.claim.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(named.release).toHaveLength(0);

    const workstream = { id: paint.id, label: "Pricing", fill: paint.fill };
    expect(regionIsPaint(workstream)).toBe(false);
    expect(regionIsWorkstream(workstream)).toBe(true);
    const cleared = regionNameChange(workstream, "  ", RECT, inside.map((entry) => ({ ...entry, frame: paint.id })));
    expect(cleared.becomes).toBe("paint");
    expect(cleared.claim).toHaveLength(0);
    expect(cleared.release).toEqual(["a", "b"]);
  });

  it("is not occupied space while it is paint", () => {
    const paint = { id: newRegionFrameId("r3"), label: null, x: 0, y: 0, width: 400, height: 300 };
    const named = { id: newRegionFrameId("r4"), label: "Pricing", x: 500, y: 0, width: 400, height: 300 };
    expect(regionOccupies(paint)).toBe(false);
    expect(regionOccupies(named)).toBe(true);
    const rects = placementRectsForFrames([paint, named]);
    expect(rects).toEqual([{ x: 500, y: 0, width: 400, height: 300 }]);
  });

  it("files a card exactly once even when two named regions hold it", () => {
    const one = { id: newRegionFrameId("r5"), label: "Pricing", fill: "rose-faded" as const };
    const two = { id: newRegionFrameId("r6"), label: "Risks", fill: "slate-faded" as const };
    const shared = card("a", one.id);
    const named = { namedFrameIds: [one.id, two.id] };
    const claimedByOne = regionClaims(one, RECT, [shared], named);
    const claimedByTwo = regionClaims(two, RECT, [shared], named);
    // The second region never moves it silently: it asks, exactly as B4 does.
    expect(claimedByOne.silent.map((entry) => entry.id)).toEqual([]);
    expect(claimedByOne.ask.map((entry) => entry.id)).toEqual(["a"]);
    expect(claimedByTwo.ask.map((entry) => entry.id)).toEqual(["a"]);
    const plan = filingPlan("task-1", [shared, { ...shared, id: "a-again" }, card("b", null)]);
    expect(plan).toEqual([
      { workItemId: "item-a", taskId: "task-1" },
      { workItemId: "item-b", taskId: "task-1" },
    ]);
  });

  it("never touches what fed anything when a card moves between regions", () => {
    const links = [{ id: "l1", fromNodeId: "n1", toNodeId: "n2", relation: "informed" }];
    const nodes = [{ id: "n1", frame: newRegionFrameId("r7") }, { id: "n2", frame: null }];
    const moved = regionFrameMove(nodes, links, "n1", newRegionFrameId("r8"));
    expect(moved.links).toBe(links);
    expect(moved.nodes[0]?.frame).toBe(newRegionFrameId("r8"));
    for (const link of moved.links) {
      expect(isRegionFrameId(link.fromNodeId)).toBe(false);
      expect(isRegionFrameId(link.toNodeId)).toBe(false);
    }
  });

  it("offers exactly the sixteen stored fills and nothing else", () => {
    expect(REGION_FILLS).toHaveLength(16);
    expect(isRegionFill("green-vivid")).toBe(true);
    expect(isRegionFill("ink")).toBe(false);
  });
});

describe("the named event reports what was filed, not what the rectangle covers", () => {
  it("reports none claimed when the rectangle holds only a brief card", () => {
    const brief = { id: "b1", frame: null, x: 20, y: 20, width: 100, height: 60, workItemId: null };
    const split = regionClaims(
      { id: newRegionFrameId("r9"), label: "Pricing" },
      RECT,
      [brief],
    );
    expect(filedWorkCount([...split.silent, ...split.frameOnly])).toBe(0);
  });

  it("reports two when the rectangle holds two work items and a brief card", () => {
    const brief = { id: "b1", frame: null, x: 20, y: 20, width: 100, height: 60, workItemId: null };
    const split = regionClaims(
      { id: newRegionFrameId("r10"), label: "Pricing" },
      RECT,
      [brief, card("a", null), card("b", null)],
    );
    expect(filedWorkCount([...split.silent, ...split.frameOnly])).toBe(2);
  });

  it("counts one piece of work once however many cards stand for it", () => {
    const shared = card("a", null);
    expect(filedWorkCount([shared, { ...shared, id: "a-again" }])).toBe(1);
  });
});
