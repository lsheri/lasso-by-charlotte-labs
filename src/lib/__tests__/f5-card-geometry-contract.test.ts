import { describe, expect, it } from "vitest";

import {
  CARD_HEIGHT,
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  CARD_WIDTH,
  seedBlankCanvas,
} from "@/components/canvas-lab/canvas-lab-model";
import {
  WORKBOARD_CARD_MIN_HEIGHT,
  WORKBOARD_CARD_MIN_WIDTH,
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
});