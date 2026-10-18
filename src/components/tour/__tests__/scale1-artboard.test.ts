import { describe, expect, it } from "vitest";
import { TOUR_BOARD_DESIGN, tourBoardScale } from "@/components/tour/TourBoard";

describe("SCALE-1 tour artboard scale", () => {
  it("returns 1 at the design width", () => expect(tourBoardScale(1160, true)).toBe(1));
  it("scales down a narrower wide container", () => expect(tourBoardScale(900, true)).toBe(900 / 1160));
  it("never scales above 1", () => expect(tourBoardScale(1600, true)).toBe(1));
  it("keeps 1 on narrow viewports", () => {
    for (const w of [276, 900, 1600]) expect(tourBoardScale(w, false)).toBe(1);
  });
  it("keeps 1 for zero or negative containers", () => {
    expect(tourBoardScale(0, true)).toBe(1);
    expect(tourBoardScale(-50, true)).toBe(1);
  });
  it("pins the design size", () => expect(TOUR_BOARD_DESIGN).toEqual({ width: 1160, height: 448 }));
});
