// DRAG-2: a section stays grabbable when a card rests on its title, and its edge band does not vanish when zoomed out.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  cardStackZ,
  labInverseZoom,
  LAB_FRONT_LIMIT,
} from "@/components/canvas-lab/canvas-lab-model";

const css = readFileSync("src/styles.css", "utf8");

describe("DRAG-2 the section title sits above cards", () => {
  it("title z-index beats every card's stack, and stays under Ask and its loops", () => {
    const z = Number(css.match(/\.canvas-lab-section-title \{ z-index: (\d+); \}/)?.[1]);
    const ids = Array.from({ length: LAB_FRONT_LIMIT }, (_, i) => `n${i}`);
    const topCard = Math.max(...ids.map((id) => cardStackZ(ids, id)), cardStackZ([], "x"));
    expect(z).toBeGreaterThan(topCard);
    expect(z).toBeLessThan(28);
  });
});

describe("DRAG-2 the edge band keeps its size on screen", () => {
  it("all four edges scale with the stage's inverse zoom", () => {
    for (const edge of ["top", "bottom"])
      expect(css).toContain(`.canvas-lab-section-edge[data-section-edge="${edge}"]`);
    expect(css.match(/height: calc\(8px \* var\(--lab-inverse-zoom, 1\)\)/g)?.length).toBe(2);
    expect(css.match(/width: calc\(8px \* var\(--lab-inverse-zoom, 1\)\)/g)?.length).toBe(2);
  });
  it("at 40% zoom the band is about 6 px on screen (was about 3)", () => {
    expect(8 * 0.4 * labInverseZoom(0.4)).toBeCloseTo(6.4);
    expect(8 * 0.4).toBeCloseTo(3.2);
  });
  it("edges stay under cards: a card resting on an edge keeps its own presses", () => {
    expect(css).not.toMatch(/\.canvas-lab-section-edge[^{]*\{[^}]*z-index/);
  });
});
