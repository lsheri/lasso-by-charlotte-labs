import { describe, expect, it } from "vitest";
import { CARD_AUTO_MAX_HEIGHT, fitCardRect, resizeLabRect } from "@/components/canvas-lab/canvas-lab-model";
import { validWorkboardNodeGeometry } from "@/lib/canvas-lab-shared";

describe("CARD-MAX", () => {
  it("lets a corner drag take a card to 1200 by 1200, and the save check accepts it", () => {
    const rect = resizeLabRect({ x: 0, y: 0, width: 300, height: 200 }, "se", { x: 5000, y: 5000 }, false, "card");
    expect(rect).toMatchObject({ width: 1200, height: 1200 });
    expect(validWorkboardNodeGeometry({ kind: "work_item" as never, w: 1200, h: 1200 })).toBe(true);
    expect(validWorkboardNodeGeometry({ kind: "work_item" as never, w: 1201, h: 400 })).toBe(false);
  });

  it("keeps Fit content at 520 tall however long the content is", () => {
    expect(CARD_AUTO_MAX_HEIGHT).toBe(520);
    expect(fitCardRect({ width: 400, height: 300 }, 3000).height).toBe(520);
  });
});
