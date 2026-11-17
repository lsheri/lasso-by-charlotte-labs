import { describe, expect, it } from "vitest";

import {
  WORKBOARD_FRAME_MAX_HEIGHT,
  WORKBOARD_FRAME_MAX_WIDTH,
  WORKBOARD_FRAME_MIN_HEIGHT,
  WORKBOARD_FRAME_MIN_WIDTH,
} from "@/lib/canvas-lab-shared";
import { drawnRect, drawnRectUsable, fittedDrawnRect } from "@/lib/workstream-draw";

describe("a drawn grouping always saves", () => {
  it("fits a drag made at 10% zoom, which covers more board than a grouping may hold", () => {
    // 600 by 400 screen pixels at 10% zoom is 6000 by 4000 on the board.
    const rect = drawnRect({ x: 1000, y: 500 }, { x: 7000, y: 4500 });
    expect(drawnRectUsable(rect)).toBe(true);
    expect(fittedDrawnRect(rect)).toEqual({ x: 1000, y: 500, width: WORKBOARD_FRAME_MAX_WIDTH, height: WORKBOARD_FRAME_MAX_HEIGHT });
  });

  it("grows a small drag made zoomed in to the smallest grouping", () => {
    const rect = drawnRect({ x: 200, y: 200 }, { x: 260, y: 250 });
    expect(drawnRectUsable(rect)).toBe(true);
    expect(fittedDrawnRect(rect)).toEqual({ x: 200, y: 200, width: WORKBOARD_FRAME_MIN_WIDTH, height: WORKBOARD_FRAME_MIN_HEIGHT });
  });

  it("keeps a drag that is already in range exactly as drawn", () => {
    const rect = drawnRect({ x: 900, y: 700 }, { x: 100, y: 100 });
    expect(fittedDrawnRect(rect)).toEqual({ x: 100, y: 100, width: 800, height: 600 });
  });

  it("is applied to both kinds of drawn grouping before they save", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain('if (drawMode === "section") void createSection(fittedDrawnRect(rect));');
    expect(page).toContain("else void createPaintRegion(fittedDrawnRect(rect));");
  });
});
