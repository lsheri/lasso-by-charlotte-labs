import { describe, expect, it } from "vitest";

import {
  CARD_HEIGHT,
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  CARD_WIDTH,
  resizeLabRect,
  seedBlankCanvas,
} from "@/components/canvas-lab/canvas-lab-model";
import {
  WORKBOARD_CARD_MIN_HEIGHT,
  WORKBOARD_CARD_MIN_WIDTH,
  WORKBOARD_SHAPE_MAX_SIZE,
  WORKBOARD_SHAPE_MIN_SIZE,
  validWorkboardNodeGeometry,
} from "@/lib/canvas-lab-shared";
import { PLACEMENT_CARD } from "@/lib/workboard-placement";

describe("F5 card geometry contract", () => {
  it("accepts every newly seeded blank-board card through save-path geometry validation", () => {
    const seeded = seedBlankCanvas({
      brief: { title: "Brief", text: "Context" },
      tasks: [],
      work: [{ id: "work-1", title: "Source", typeLabel: "document", source: "upload", ownedByViewer: true, taskIds: [], deliverable: false }],
      decisions: [],
    });

    expect(seeded.length).toBeGreaterThan(0);
    for (const card of seeded) {
      expect(validWorkboardNodeGeometry({ x: card.x, y: card.y, w: card.width, h: card.height })).toBe(true);
    }
  });

  it("keeps seeded defaults above the interaction floor and the interaction floor above the record floor", () => {
    expect(CARD_WIDTH).toBeGreaterThanOrEqual(CARD_MIN_WIDTH);
    expect(CARD_HEIGHT).toBeGreaterThanOrEqual(CARD_MIN_HEIGHT);
    expect(PLACEMENT_CARD).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
    expect(CARD_MIN_WIDTH).toBeGreaterThanOrEqual(WORKBOARD_CARD_MIN_WIDTH);
    expect(CARD_MIN_HEIGHT).toBeGreaterThanOrEqual(WORKBOARD_CARD_MIN_HEIGHT);
  });

  it("keeps block resize limits within the block record limits", () => {
    const maximum = resizeLabRect(
      { x: 0, y: 0, width: WORKBOARD_SHAPE_MIN_SIZE, height: WORKBOARD_SHAPE_MIN_SIZE },
      "se",
      { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER },
      false,
      "shape",
    );

    expect(maximum).toMatchObject({ width: WORKBOARD_SHAPE_MAX_SIZE, height: WORKBOARD_SHAPE_MAX_SIZE });
    expect(validWorkboardNodeGeometry({ kind: "shape", w: maximum.width, h: maximum.height })).toBe(true);
  });
});