import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { turnConnectorD } from "@/lib/journey-path";
import {
  CARD_GAP_MIN,
  CARD_STEP_MS,
  TURN_CARD_H,
  TURN_CARD_W,
  layoutTurnWalk,
  turnCards,
  type TurnStage,
} from "@/lib/turn-story-shared";
import { RESOLVE_GRACE_MS } from "@/lib/verify-thread-shared";
import { READ_SPEED_PX_S, advanceScroll, type ScrollState } from "@/lib/working-scroll";

const STORY = readFileSync("src/components/verify/TurnCardStory.tsx", "utf8");
const SHARED = readFileSync("src/lib/turn-story-shared.ts", "utf8");
const SCROLL = readFileSync("src/lib/working-scroll.ts", "utf8");
const READER = readFileSync("src/components/verify/VerifyThreadReader.tsx", "utf8");

const STAGE: TurnStage = { width: 520, height: 620 };

function makeCards(count: number, itemId = "item-a") {
  return turnCards(
    itemId,
    Array.from({ length: count }, (_, i) => ({
      id: `t${i + 1}`,
      turn_no: i + 1,
      role: i % 2 === 0 ? "user" : "assistant",
      content: `turn ${i + 1} text`,
    })),
  );
}

/** Simulate a second of reading at 16ms frames. */
function travelInOneSecond(maxScroll: number, from = 400): number {
  let state: ScrollState = { pos: from, dir: 1 };
  for (let t = 0; t < 1000; t += 16) state = advanceScroll(state, maxScroll, 16);
  return state.pos - from;
}

describe("pass 133 constant reading speed", () => {
  it("exports the speed and moves the same px/sec whatever the content height", () => {
    expect(READ_SPEED_PX_S).toBe(55);
    const short = travelInOneSecond(2000);
    const long = travelInOneSecond(40000);
    expect(short).toBeCloseTo(READ_SPEED_PX_S, 0);
    expect(long).toBeCloseTo(READ_SPEED_PX_S, 0);
    expect(Math.abs(short - long)).toBeLessThan(0.5);
  });

  it("ping-pongs at the extremes without a jump cut", () => {
    let state: ScrollState = { pos: 0, dir: 1 };
    const max = 120;
    let reachedBottom = false;
    let reversedUp = false;
    let previous = state.pos;
    for (let t = 0; t < 12000; t += 16) {
      state = advanceScroll(state, max, 16);
      expect(state.pos).toBeGreaterThanOrEqual(0);
      expect(state.pos).toBeLessThanOrEqual(max);
      // Continuity: never more than one frame of travel in a single step.
      expect(Math.abs(state.pos - previous)).toBeLessThanOrEqual(
        (READ_SPEED_PX_S * 16) / 1000 + 0.001,
      );
      previous = state.pos;
      if (state.pos === max) reachedBottom = true;
      if (reachedBottom && state.dir === -1) reversedUp = true;
      if (reversedUp && state.dir === 1 && state.pos === 0) break;
    }
    expect(reachedBottom).toBe(true);
    expect(reversedUp).toBe(true);
  });

  it("is delta driven, never per-frame constants", () => {
    expect(SCROLL).toContain("dtMs");
    expect(READER).toContain("advanceScroll(state, maxScroll, dtMs)");
    expect(READER).not.toContain("const cycle = 9000");
  });
});

describe("pass 133 canvas walk", () => {
  it("is deterministic per item and different between items", () => {
    const a = layoutTurnWalk("item-a", makeCards(12), STAGE);
    const again = layoutTurnWalk("item-a", makeCards(12), STAGE);
    const b = layoutTurnWalk("item-b", makeCards(12, "item-b"), STAGE);
    expect(a).toEqual(again);
    expect(a.map((p) => `${p.x},${p.y}`)).not.toEqual(b.map((p) => `${p.x},${p.y}`));
  });

  it("never overlaps and never leaves the stage, for 1..40 turns", () => {
    for (let count = 1; count <= 40; count += 1) {
      const places = layoutTurnWalk("item-a", makeCards(count), STAGE);
      expect(places).toHaveLength(count);
      for (const place of places) {
        expect(place.x).toBeGreaterThanOrEqual(0);
        expect(place.y).toBeGreaterThanOrEqual(0);
        expect(place.x + TURN_CARD_W).toBeLessThanOrEqual(STAGE.width);
        expect(place.y + TURN_CARD_H).toBeLessThanOrEqual(STAGE.height);
      }
      for (let i = 0; i < places.length; i += 1) {
        for (let j = i + 1; j < places.length; j += 1) {
          const a = places[i]!;
          const b = places[j]!;
          if (a.page !== b.page) continue;
          const apart =
            a.x + TURN_CARD_W + CARD_GAP_MIN <= b.x ||
            b.x + TURN_CARD_W + CARD_GAP_MIN <= a.x ||
            a.y + TURN_CARD_H + CARD_GAP_MIN <= b.y ||
            b.y + TURN_CARD_H + CARD_GAP_MIN <= a.y;
          expect(apart).toBe(true);
        }
      }
    }
  });

  it("actually snakes: both horizontal directions inside ten turns", () => {
    const places = layoutTurnWalk("item-a", makeCards(10), STAGE);
    const deltas = places
      .slice(1)
      .map((place, index) => place.x - places[index]!.x)
      .filter((dx) => dx !== 0);
    expect(deltas.some((dx) => dx > 0)).toBe(true);
    expect(deltas.some((dx) => dx < 0)).toBe(true);
  });

  it("turns the page rather than overlapping when the paper runs out", () => {
    const tight: TurnStage = { width: 260, height: 300 };
    const places = layoutTurnWalk("item-a", makeCards(20), tight);
    expect(places).toHaveLength(20);
    expect(Math.max(...places.map((p) => p.page))).toBeGreaterThan(0);
  });
});

describe("pass 133 connectors", () => {
  it("orients the arrowhead along a leftward tangent", () => {
    const left = turnConnectorD("seed", { x: 300, y: 40 }, { x: 60, y: 60 });
    // Both barbs sit behind the tip, i.e. to the RIGHT of it, when travelling left.
    for (const stroke of left.arrow) {
      const end = stroke.d.trim().split(/[ML]/).filter(Boolean).pop() as string;
      const [x] = end.trim().split(/[ ,]+/).map(Number) as [number, number];
      expect(x).toBeGreaterThan(60);
    }
    const right = turnConnectorD("seed", { x: 60, y: 40 }, { x: 300, y: 60 });
    for (const stroke of right.arrow) {
      const end = stroke.d.trim().split(/[ML]/).filter(Boolean).pop() as string;
      const [x] = end.trim().split(/[ ,]+/).map(Number) as [number, number];
      expect(x).toBeLessThan(300);
    }
  });
});

describe("pass 133 cadence, grace and hygiene", () => {
  it("pins the unhurried cadence and the grace beat", () => {
    expect(CARD_STEP_MS).toBe(1400);
    expect(CARD_GAP_MIN).toBe(18);
    expect(RESOLVE_GRACE_MS).toBe(6000);
    expect(STORY).toContain("CARD_STEP_MS");
  });

  it("holds the pending scene through grace, and cuts it for skip", () => {
    expect(READER).toContain("request.runId === null || grace.holding");
    expect(READER).toContain("onSkip={grace.cut}");
    expect(READER).toContain("onSkip?.()");
  });

  it("gives no grace to a failure or to reduced motion, and cleans its timer", () => {
    expect(READER).toContain("if (failed || prefersReducedMotion()) return;");
    expect(READER).toContain("useEffect(() => clear, [clear]);");
    expect(READER).toContain("window.clearTimeout");
  });

  it("adds no randomness, no inline paths, no queries and no events", () => {
    for (const text of [STORY, SHARED, SCROLL]) {
      expect(text).not.toContain("Math.random");
      expect(text).not.toMatch(/d="M[\s\d]/);
      expect(text).not.toContain("supabase");
      expect(text).not.toContain("logEvent");
    }
  });
});
