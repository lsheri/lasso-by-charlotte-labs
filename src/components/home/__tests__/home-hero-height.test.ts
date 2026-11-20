// 20 Nov 2026 redraw: the welcome starts just under Home's toolbar, so the boards are on the first screen sooner.
import { describe, expect, it } from "vitest";

import { HOME_HERO_BOTTOM_MARGIN, HOME_HERO_CONTENT_HEIGHT, HOME_HERO_FRAME_HEIGHT, homeFramesForViewport } from "@/components/home/HomeBoard";

describe("Home: the boards come up sooner", () => {
  it("the welcome frame lost its empty top and nothing else", () => {
    // 104 from the top of the board less the 32 fit padding, then the measured content and its margin, unchanged.
    expect(HOME_HERO_FRAME_HEIGHT).toBe(104 - 32 + HOME_HERO_CONTENT_HEIGHT + HOME_HERO_BOTTOM_MARGIN);
    expect(HOME_HERO_CONTENT_HEIGHT).toBe(286);
  });

  it("the boards start 82 higher than before, at every width, and still below the welcome", () => {
    for (const width of [390, 980, 1440]) {
      const [hero, grid] = homeFramesForViewport({ width, height: 800 }, 6);
      expect(grid!.y).toBe(hero!.y + hero!.height + 24);
      expect(grid!.y).toBe(32 + 406 + 24);
      expect(32 + (186 - 32 + 286 + 48) + 24 - grid!.y).toBe(82);
    }
  });

  it("a welcome that wraps taller on a phone pushes the boards down by exactly the extra, and never pulls them up", () => {
    const [, desk] = homeFramesForViewport({ width: 390, height: 800 }, 2, 0);
    const [hero, grid] = homeFramesForViewport({ width: 390, height: 800 }, 2, 0, 467);
    expect(grid!.y - desk!.y).toBe(467 - HOME_HERO_CONTENT_HEIGHT);
    expect(grid!.y).toBeGreaterThanOrEqual(hero!.y + (104 - 32) + 467);
    const [, shorter] = homeFramesForViewport({ width: 1440, height: 800 }, 2, 0, 120);
    expect(shorter!.y).toBe(desk!.y);
  });
});
