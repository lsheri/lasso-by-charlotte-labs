import { describe, expect, it } from "vitest";

import { BOARD_GUIDE_RECTS } from "@/components/canvas-lab/canvas-lab-model";
import {
  PLACEMENT_CARD,
  PLACEMENT_GAP,
  nearestFreeSlot,
  placeAddedCards,
  slotIsFree,
  type PlacementRect,
} from "@/lib/workboard-placement";

const card = (x: number, y: number): PlacementRect => ({ x, y, ...PLACEMENT_CARD });

function noneOverlap(rects: PlacementRect[]): boolean {
  return rects.every((rect, index) =>
    slotIsFree(rect, rects.filter((_, other) => other !== index), PLACEMENT_GAP),
  );
}

describe("workboard placement", () => {
  it("puts a card at the chosen point on an empty board", () => {
    const [point] = placeAddedCards({ x: 220, y: 154 }, [], 1);
    expect(point).toEqual({ x: 220, y: 154 });
  });

  it("keeps clear of a card already sitting at the chosen point", () => {
    const taken = [card(0, 0)];
    const point = nearestFreeSlot({ x: 0, y: 0 }, taken);
    expect(slotIsFree({ ...point, ...PLACEMENT_CARD }, taken)).toBe(true);
  });

  it("finds room when the chosen point is crowded on every side", () => {
    const taken: PlacementRect[] = [];
    for (let column = -2; column <= 2; column += 1) {
      for (let row = -2; row <= 2; row += 1) taken.push(card(column * 264, row * 154));
    }
    const point = nearestFreeSlot({ x: 0, y: 0 }, taken);
    expect(slotIsFree({ ...point, ...PLACEMENT_CARD }, taken)).toBe(true);
  });

  it("lays several items out without any of them touching", () => {
    const taken = [card(286, 0), card(0, 220)];
    const points = placeAddedCards({ x: 0, y: 0 }, taken, 7);
    expect(points).toHaveLength(7);
    const placed = points.map((point) => ({ ...point, ...PLACEMENT_CARD }));
    expect(noneOverlap([...taken, ...placed])).toBe(true);
  });

  it("works above and left of the board origin", () => {
    const taken = [card(-600, -400)];
    const points = placeAddedCards({ x: -600, y: -400 }, taken, 3);
    expect(points.some((point) => point.x < 0 && point.y < 0)).toBe(true);
    const placed = points.map((point) => ({ ...point, ...PLACEMENT_CARD }));
    expect(noneOverlap([...taken, ...placed])).toBe(true);
  });

  it("keeps clear of workstream outlines, not only cards", () => {
    const outline: PlacementRect = { x: 0, y: 0, width: 430, height: 520 };
    const point = nearestFreeSlot({ x: 60, y: 60 }, [outline]);
    expect(slotIsFree({ ...point, ...PLACEMENT_CARD }, [outline])).toBe(true);
  });

  it("keeps added cards off the board's fixed guide panels", () => {
    const guides = BOARD_GUIDE_RECTS.map((rect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }));
    // The chosen point sits inside the Reasoning trail guide.
    const anchor = { x: BOARD_GUIDE_RECTS[0]!.x + 40, y: BOARD_GUIDE_RECTS[0]!.y + 40 };
    const points = placeAddedCards(anchor, guides, 2);
    expect(points).toHaveLength(2);
    for (const point of points) {
      expect(slotIsFree({ ...point, ...PLACEMENT_CARD }, guides)).toBe(true);
    }
    expect(noneOverlap(points.map((point) => ({ ...point, ...PLACEMENT_CARD })))).toBe(true);
  });
});
