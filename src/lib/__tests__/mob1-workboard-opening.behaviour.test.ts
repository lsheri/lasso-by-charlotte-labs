import { describe, expect, it } from "vitest";
import { fitWorkboardViewport } from "@/components/canvas-lab/canvas-lab-model";
import { OPENING_ZOOM_MIN, workboardOpeningView } from "@/lib/workboard-opening-view";

const nodes = Array.from({ length: 10 }, (_, i) => ({ id: `card-${i}`, x: 100 + (i % 5) * 352, y: 100 + Math.floor(i / 5) * 264, width: 320, height: 200 }));
const fit = (width: number) => fitWorkboardViewport({ width: width - 52, height: 700 }, [], nodes, new Map(), null);

describe("phone workboard opening", () => {
  it("opens many cards at native text size rather than fitting everything", () => {
    const fitted = fit(390);
    expect(fitted.zoom).toBeCloseTo((390 - 64) / 2056);
    const opened = workboardOpeningView(390, fitted, nodes);
    expect(opened.zoom).toBe(1);
    expect(opened.pan).toEqual({ x: -68, y: -14 });
    expect(100 * opened.zoom + opened.pan.x).toBe(32);
    expect(100 * opened.zoom + opened.pan.y).toBe(86);
  });
  it("preserves desktop zoom and clears the floating bar at and above the 768px boundary", () => {
    const wide = fit(1280);
    const opened = workboardOpeningView(1280, wide, nodes);
    expect(opened.zoom).toBe(wide.zoom);
    expect(opened.pan.x).toBe(wide.pan.x);
    expect(opened.bounds.y * opened.zoom + opened.pan.y).toBeGreaterThanOrEqual(86);
    const boundary = fit(768);
    expect(boundary.zoom).toBeLessThan(0.4);
    expect(workboardOpeningView(768, boundary, nodes).zoom).toBe(0.4);
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
    expect(opened.pan).toEqual({ x: 32, y: 86 });
    expect(Number.isFinite(opened.pan.x) && Number.isFinite(opened.pan.y)).toBe(true);
  });
  it("anchors the first card in reading order regardless of array order", () => {
    expect(workboardOpeningView(390, fit(390), [...nodes].reverse()).pan).toEqual({ x: -68, y: -14 });
  });
  it("never opens below 0.4 on a board large enough that fit alone would go lower", () => {
    const huge = Array.from({ length: 40 }, (_, i) => ({ id: `big-${i}`, x: 100 + (i % 10) * 900, y: 100 + Math.floor(i / 10) * 900, width: 320, height: 200 }));
    const fitted = fitWorkboardViewport({ width: 1228, height: 700 }, [], huge, new Map(), null);
    expect(fitted.zoom).toBeLessThan(0.4);
    const opened = workboardOpeningView(1280, fitted, huge);
    expect(OPENING_ZOOM_MIN).toBe(0.4);
    expect(opened.zoom).toBe(0.4);
    expect(opened.bounds.x * opened.zoom + opened.pan.x).toBe(32);
    expect(opened.bounds.y * opened.zoom + opened.pan.y).toBe(86);
  });
});
