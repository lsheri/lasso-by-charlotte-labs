import { describe, expect, it } from "vitest";
import { fitWorkboardViewport } from "@/components/canvas-lab/canvas-lab-model";
import { workboardOpeningView } from "@/lib/workboard-opening-view";

const nodes = Array.from({ length: 10 }, (_, i) => ({ id: `card-${i}`, x: 100 + (i % 5) * 352, y: 100 + Math.floor(i / 5) * 264, width: 320, height: 200 }));
const fit = (width: number) => fitWorkboardViewport({ width: width - 52, height: 700 }, [], nodes, new Map(), null);

describe("phone workboard opening", () => {
  it("opens many cards at native text size rather than fitting everything", () => {
    const fitted = fit(390);
    expect(fitted.zoom).toBe(0.4);
    const opened = workboardOpeningView(390, fitted, nodes);
    expect(opened.zoom).toBe(1);
    expect(opened.pan).toEqual({ x: -68, y: -68 });
    expect(100 * opened.zoom + opened.pan.x).toBe(32);
    expect(100 * opened.zoom + opened.pan.y).toBe(32);
  });
  it("leaves desktop fit unchanged at and above the 768px boundary", () => {
    for (const width of [768, 1280]) {
      const fitted = fit(width);
      expect(workboardOpeningView(width, fitted, nodes)).toBe(fitted);
    }
    expect(fit(1280).zoom).toBeCloseTo(1164 / 1728);
  });
  it("never exceeds 100 percent", () => {
    for (const width of [320, 390, 767, 768, 1280, 2400]) {
      const opened = workboardOpeningView(width, fit(width), nodes);
      expect(opened.zoom).toBeLessThanOrEqual(1);
      expect(opened.zoom).toBeGreaterThan(0);
    }
  });
  it("keeps an empty board finite and usable", () => {
    const fitted = fitWorkboardViewport({ width: 338, height: 700 }, [], [], new Map(), null);
    const opened = workboardOpeningView(390, fitted, []);
    expect(opened.zoom).toBe(1);
    expect(opened.pan).toEqual({ x: 32, y: 32 });
    expect(Number.isFinite(opened.pan.x) && Number.isFinite(opened.pan.y)).toBe(true);
  });
  it("anchors the first card in reading order regardless of array order", () => {
    expect(workboardOpeningView(390, fit(390), [...nodes].reverse()).pan).toEqual({ x: -68, y: -68 });
  });
});