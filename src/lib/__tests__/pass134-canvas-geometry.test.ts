import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { turnConnectorD, turnConnectorStyle } from "@/lib/journey-path";
import {
  CARD_GAP_MIN,
  TURN_CARD_H,
  TURN_CARD_W,
  WALK_ANGLES,
  WALK_STEP_MAX,
  WALK_STEP_MIN,
  edgeAnchor,
  layoutTurnWalk,
  turnCards,
  type TurnStage,
} from "@/lib/turn-story-shared";

const STORY = readFileSync("src/components/verify/TurnCardStory.tsx", "utf8");
const READER = readFileSync("src/components/verify/VerifyThreadReader.tsx", "utf8");
const STATE = readFileSync("src/components/verify/verify-thread-state.ts", "utf8");

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

describe("pass 134 honest geometry", () => {
  it("renders the card at exactly the layout footprint, never wrapping", () => {
    expect(STORY).toContain("style={{ width: TURN_CARD_W, height: TURN_CARD_H, ...style }}");
    expect(STORY).toContain("overflow-hidden");
    expect(STORY.match(/whiteSpace: "nowrap"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(STORY).toContain("truncate");
  });

  it("gives the walk more room", () => {
    expect(CARD_GAP_MIN).toBe(36);
    expect(WALK_STEP_MIN).toBe(150);
    expect(WALK_STEP_MAX).toBe(260);
  });

  it("still never overlaps and never leaves the stage, for 1..40 turns", () => {
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

  it("walks at several distinct angles, including a near-horizontal one", () => {
    expect(WALK_ANGLES.length).toBeGreaterThanOrEqual(6);
    const places = layoutTurnWalk("item-a", makeCards(12), STAGE);
    const steps = places
      .slice(1)
      .map((place, index) => ({ dx: place.x - places[index]!.x, dy: place.y - places[index]!.y }))
      .filter((s) => s.dx !== 0 || s.dy !== 0);
    const angles = new Set(steps.map((s) => Math.round(Math.atan2(s.dy, s.dx) * 8)));
    expect(angles.size).toBeGreaterThanOrEqual(3);
    expect(steps.some((s) => s.dx !== 0 && Math.abs(s.dy / s.dx) < 1)).toBe(true);
    expect(steps.some((s) => s.dx > 0)).toBe(true);
    expect(steps.some((s) => s.dx < 0)).toBe(true);
  });
});

describe("pass 134 connectors", () => {
  it("reaches all three seeded styles, deterministically", () => {
    const styles = new Set<string>();
    for (let i = 0; i < 40; i += 1) styles.add(turnConnectorStyle(`item-a:${i}`));
    expect([...styles].sort()).toEqual(["curve", "elbow", "s"]);
    expect(turnConnectorStyle("item-a:3")).toBe(turnConnectorStyle("item-a:3"));
  });

  it("draws an elbow with an actual corner in it", () => {
    let seed = "";
    for (let i = 0; i < 60 && !seed; i += 1) {
      if (turnConnectorStyle(`elbow:${i}`) === "elbow") seed = `elbow:${i}`;
    }
    expect(seed).not.toBe("");
    const connector = turnConnectorD(seed, { x: 20, y: 20 }, { x: 260, y: 220 });
    const pts = [...connector.stroke.d.matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g)].map(
      (m) => ({ x: Number(m[1]), y: Number(m[2]) }),
    );
    const angles = pts
      .slice(1)
      .map((p, i) => Math.atan2(p.y - pts[i]!.y, p.x - pts[i]!.x));
    const spread = Math.max(...angles) - Math.min(...angles);
    expect(spread).toBeGreaterThan(0.2);
    expect(turnConnectorD(seed, { x: 20, y: 20 }, { x: 260, y: 220 }).stroke.d).toBe(
      connector.stroke.d,
    );
  });

  it("anchors on the edge facing the direction of travel", () => {
    const rect = { x: 100, y: 100 };
    expect(edgeAnchor(rect, { x: 0, y: 200 })).toEqual({
      x: 100 + TURN_CARD_W / 2,
      y: 100 + TURN_CARD_H,
    });
    expect(edgeAnchor(rect, { x: 200, y: 20 })).toEqual({
      x: 100 + TURN_CARD_W,
      y: 100 + TURN_CARD_H / 2,
    });
    expect(edgeAnchor(rect, { x: -200, y: 20 })).toEqual({ x: 100, y: 100 + TURN_CARD_H / 2 });
    expect(edgeAnchor(rect, { x: 0, y: -200 })).toEqual({ x: 100 + TURN_CARD_W / 2, y: 100 });
    expect(STORY).toContain("edgeAnchor(prev, direction)");
  });
});

describe("pass 134 the story plays every time", () => {
  it("remembers no skip anywhere", () => {
    for (const text of [READER, STATE]) {
      expect(text).not.toContain("lasso.reader.skip_story");
      expect(text).not.toContain("storyPlayed");
    }
    expect(READER).toContain("lasso.reader.rail_wide");
  });

  it("suppresses the story only for reduced motion and zero findings", () => {
    expect(READER).toContain("const suppressed = reduced || anchored.length === 0;");
    expect(READER).toContain("const [sourceOpen, setSourceOpen] = useState(true);");
  });
});
