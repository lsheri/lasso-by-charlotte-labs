import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { applyMarqueeSelection, cardsInMarquee, isMarqueeClick, marqueeRect } from "../canvas-lab-marquee";

const page = readFileSync(resolve(process.cwd(), "src/pages/CanvasLabPage.tsx"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const card = (id: string, x: number, y: number, kind = "work") => ({ id, kind, x, y, width: 100, height: 80 });

describe("B3 marquee", () => {
  it("builds the box from any drag direction", () => {
    expect(marqueeRect({ x: 50, y: 60 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, width: 40, height: 40 });
  });

  it("picks cards the box touches, including a partly covered one", () => {
    const nodes = [card("in", 0, 0), card("part", 180, 0), card("out", 400, 400), card("deco", 10, 10, "shape")];
    expect(cardsInMarquee({ x: -10, y: -10, width: 200, height: 50 }, nodes)).toEqual(["in", "part"]);
  });

  it("uses measured heights and skips removed cards", () => {
    const nodes = [card("tall", 0, 0), card("gone", 0, 0)];
    const heights = new Map([["tall", 300]]);
    expect(cardsInMarquee({ x: 0, y: 250, width: 20, height: 20 }, nodes, heights, ["gone"])).toEqual(["tall"]);
  });

  it("treats under 4px in both directions as a click", () => {
    expect(isMarqueeClick(marqueeRect({ x: 0, y: 0 }, { x: 3, y: 3 }))).toBe(true);
    expect(isMarqueeClick(marqueeRect({ x: 0, y: 0 }, { x: 4, y: 1 }))).toBe(false);
  });

  it("replaces the selection, or adds with Shift", () => {
    expect(applyMarqueeSelection(["a"], ["b"], false)).toEqual(["b"]);
    expect(applyMarqueeSelection(["a", "b"], ["b", "c"], true)).toEqual(["a", "b", "c"]);
  });

  it("pans on the middle button and ends the marquee on the shared end path", () => {
    expect(page).toContain("event.button === 1 && empty");
    expect(page).toContain("|| marqueeRef.current);");
    const end = page.slice(page.indexOf("function endInteraction("));
    expect(end.slice(0, 400)).toContain("marqueeRef.current = null;");
    expect(css).toContain(".canvas-lab-marquee");
  });
});
