import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readingEyesD, READING_EYES_BOX } from "@/lib/journey-path";
import {
  TURN_CARD_H,
  TURN_CARD_W,
  layoutTurnWalk,
  type TurnCard,
} from "@/lib/turn-story-shared";

function cards(n: number): TurnCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    turnNo: i + 1,
    isAssistant: i % 2 === 1,
    label: `TURN ${i + 1}`,
    snippet: "line",
    dx: 0,
  }));
}

const STAGE = { width: 620, height: 900 };

describe("pass 135 — the snake rule", () => {
  it("never repeats the angle of the step before it", () => {
    const places = layoutTurnWalk("item-snake", cards(12), STAGE);
    let last: number | null = null;
    for (let i = 1; i < places.length; i += 1) {
      const a = places[i - 1]!;
      const b = places[i]!;
      if (b.page !== a.page) {
        last = null;
        continue;
      }
      const angle = Math.round((Math.atan2(b.y - a.y, Math.abs(b.x - a.x)) * 180) / Math.PI);
      if (last !== null) expect(angle).not.toBe(last);
      last = angle;
    }
  });

  it("keeps the 134 laws: in bounds, never overlapping", () => {
    for (let n = 1; n <= 40; n += 1) {
      const places = layoutTurnWalk(`item-${n}`, cards(n), STAGE);
      expect(places).toHaveLength(n);
      for (const p of places) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + TURN_CARD_W).toBeLessThanOrEqual(STAGE.width);
        expect(p.y + TURN_CARD_H).toBeLessThanOrEqual(STAGE.height);
      }
    }
  });

  it("stays deterministic", () => {
    expect(layoutTurnWalk("same", cards(9), STAGE)).toEqual(
      layoutTurnWalk("same", cards(9), STAGE),
    );
  });
});

describe("pass 135 — the reading eyes", () => {
  const marks = readFileSync("src/components/notebook/marks.tsx", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");
  const reader = readFileSync("src/components/verify/VerifyThreadReader.tsx", "utf8");

  it("draws spectacles from journey-path, not an inline string", () => {
    const eyes = readingEyesD("seed");
    expect(eyes.frame.length).toBeGreaterThanOrEqual(5);
    for (const d of eyes.frame) expect(d.startsWith("M ")).toBe(true);
    expect(eyes.pupils).toHaveLength(2);
    expect(READING_EYES_BOX.width).toBe(72);
    expect(marks).toContain("export function ReadingEyes");
    expect(marks).toContain("readingEyesD");
    expect(marks).not.toMatch(/d="M[^"]/);
  });

  it("is seeded and deterministic", () => {
    expect(readingEyesD("a")).toEqual(readingEyesD("a"));
    expect(readingEyesD("a")).not.toEqual(readingEyesD("b"));
  });

  it("animates the pupils by CSS keyframe, neutralized under reduced motion", () => {
    expect(styles).toContain("@keyframes nb-reading-scan");
    expect(styles).toMatch(/\.nb-reading-pupil \{[^}]*animation: nb-reading-scan 1600ms/);
    const blocks = styles
      .split("@media (prefers-reduced-motion: reduce)")
      .slice(1)
      .filter((block) => block.includes(".nb-reading-pupil"));
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]!).toContain("animation: none !important");
  });

  it("stays centred in the scrolling viewport", () => {
    const rule = styles.slice(styles.indexOf(".nb-reading-eyes {"));
    expect(rule).toContain("position: sticky");
    expect(rule).toContain("top: 50%");
    expect(rule).toContain("translateY(-50%)");
    expect(styles).toContain(".nb-reading-eyes-halo");
  });

  it("replaces the pending transcript dots with the eyes", () => {
    const pending = reader.slice(0, reader.indexOf("function ReaderBody"));
    expect(pending).not.toContain("nb-dots");
    expect(pending).toContain("<ReadingEyes");
  });
});
