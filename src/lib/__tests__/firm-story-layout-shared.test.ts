import { describe, expect, it } from "vitest";

import { storyCardPlacement, storyCardTop, storyPlacementRect, storyScrollDelta, type StoryLayoutMetrics } from "../firm-story-layout-shared";

// A laptop: 1440 x 900, sidebar 270 wide, card 416 x 340 at the bottom, 16 from the edge.
const laptop: StoryLayoutMetrics = { card: { width: 416, height: 340 }, viewport: { width: 1440, height: 900 }, startLeft: 270, bottomOffset: 16, topInset: 0, wide: true };
// A phone: 390 x 844, a 61px fixed header, the card centred above the tab bar.
const phone: StoryLayoutMetrics = { card: { width: 358, height: 420 }, viewport: { width: 390, height: 844 }, startLeft: 16, bottomOffset: 72, topInset: 61, wide: false };
const askBox = (top: number, height = 172) => ({ top, left: 338, width: 1022, height });

describe("where the story card sits", () => {
  it("stays in its usual place when it covers nothing of the target", () => {
    expect(storyCardPlacement(askBox(64), laptop)).toBe("bottom-start");
    expect(storyCardPlacement(null, laptop)).toBe("bottom-start");
  });

  it("moves to a corner that covers none of the target when its usual place would", () => {
    // The target is low on the screen and spans the page: both bottom corners cover it, the top ones do not.
    expect(storyCardPlacement(askBox(500), laptop)).toBe("top-end");
    // A narrow target under the card only: the other bottom corner is clear.
    expect(storyCardPlacement({ top: 600, left: 300, width: 300, height: 200 }, laptop)).toBe("bottom-end");
  });

  it("stays put when every corner would cover a target as tall as the screen (the firm map)", () => {
    expect(storyCardPlacement({ top: 150, left: 314, width: 1070, height: 900 }, laptop)).toBe("bottom-start");
  });

  it("goes to the top on a phone when the beat asks for it, and ignores the ask on a wide screen", () => {
    const map = { top: 205, left: 16, width: 358, height: 1400 };
    expect(storyCardPlacement(map, phone)).toBe("bottom-start");
    expect(storyCardPlacement(map, phone, true)).toBe("top-start");
    expect(storyCardPlacement({ top: 150, left: 314, width: 1070, height: 900 }, laptop, true)).toBe("bottom-start");
    expect(storyCardPlacement(null, phone, true)).toBe("bottom-start");
  });

  it("only counts the part of the target that is on screen", () => {
    expect(storyCardPlacement({ top: 880, left: 338, width: 1022, height: 300 }, { ...laptop, bottomOffset: 30 })).toBe("bottom-start");
  });

  it("on a phone goes to the top, under the header, or stays", () => {
    expect(storyCardPlacement({ top: 560, left: 16, width: 358, height: 200 }, phone)).toBe("top-start");
    expect(storyPlacementRect("top-start", phone).top).toBe(69);
    expect(storyPlacementRect("top-end", phone).left).toBe(16);
    expect(storyCardPlacement({ top: 73, left: 16, width: 358, height: 320 }, phone)).toBe("bottom-start");
    expect(storyCardTop(laptop)).toBe(16);
  });
});

describe("how far the page moves when a beat starts", () => {
  it("does not move a target that is already in sight and clear of the card", () => {
    expect(storyScrollDelta(askBox(64), laptop)).toBe(0);
  });

  it("puts a target that sits under the card at the top of the screen", () => {
    expect(storyScrollDelta(askBox(480), laptop)).toBe(468);
  });

  it("brings back a target that is above or below the screen", () => {
    expect(storyScrollDelta(askBox(-300), laptop)).toBe(-312);
    expect(storyScrollDelta(askBox(1400), laptop)).toBe(1388);
  });

  it("puts a target that cannot clear the card at the top, so most of it shows (Ask the firm on a phone)", () => {
    expect(storyScrollDelta({ top: 345, left: 16, width: 358, height: 313 }, phone)).toBe(272);
    expect(storyScrollDelta({ top: 73, left: 16, width: 358, height: 313 }, phone)).toBe(0);
  });

  it("leaves a target that fills the screen alone while its top is in sight, and fetches it when it is not", () => {
    const map = { top: 150, left: 314, width: 1070, height: 900 };
    expect(storyScrollDelta(map, laptop)).toBe(0);
    expect(storyScrollDelta({ ...map, top: 700 }, laptop)).toBe(688);
  });

  it("clears the phone's fixed header", () => {
    expect(storyScrollDelta({ top: 500, left: 16, width: 358, height: 200 }, phone)).toBe(427);
    expect(storyScrollDelta({ top: 20, left: 16, width: 358, height: 200 }, phone)).toBe(-53);
  });

  it("ignores a move of a few pixels", () => {
    expect(storyScrollDelta({ top: 26, left: 338, width: 1022, height: 600 }, { ...laptop, topInset: 12 })).toBe(0);
  });
});
