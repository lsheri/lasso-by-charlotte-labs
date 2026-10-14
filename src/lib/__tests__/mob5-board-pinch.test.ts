import { describe, expect, it } from "vitest";

import { beginPinch, panView, pinchDistance, pinchMidpoint, pinchView } from "@/lib/board-pinch";
import { ZOOM_MAX, ZOOM_MIN } from "@/lib/canvas-zoom";

describe("pinch maths", () => {
  it("finds the midpoint and distance of two fingers", () => {
    expect(pinchMidpoint({ x: 0, y: 0 }, { x: 100, y: 40 })).toEqual({ x: 50, y: 20 });
    expect(pinchDistance({ x: 0, y: 0 }, { x: 30, y: 40 })).toBe(50);
  });

  it("zooms by the distance ratio and holds the board point under the midpoint", () => {
    const start = beginPinch({ pan: { x: 10, y: 20 }, zoom: 1 }, { x: 100, y: 100 }, { x: 200, y: 100 });
    const view = pinchView(start, { x: 50, y: 100 }, { x: 250, y: 100 });
    expect(view.zoom).toBeCloseTo(1.6, 5);
    // board point under midpoint (150,100) before: (140, 80); after it is still under (150,100)
    expect((150 - view.pan.x) / view.zoom).toBeCloseTo(140, 5);
    expect((100 - view.pan.y) / view.zoom).toBeCloseTo(80, 5);
  });

  it("pans with the midpoint when the fingers move together", () => {
    const start = beginPinch({ pan: { x: 0, y: 0 }, zoom: 0.8 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    const view = pinchView(start, { x: 30, y: 40 }, { x: 130, y: 40 });
    expect(view.zoom).toBeCloseTo(0.8, 5);
    expect(view.pan.x).toBeCloseTo(30, 5);
    expect(view.pan.y).toBeCloseTo(40, 5);
  });
});

describe("pinch clamping", () => {
  const start = beginPinch({ pan: { x: 0, y: 0 }, zoom: 1 }, { x: 0, y: 0 }, { x: 100, y: 0 });
  it("never goes above the maximum", () => {
    expect(pinchView(start, { x: 0, y: 0 }, { x: 1000, y: 0 }).zoom).toBe(ZOOM_MAX);
  });
  it("never goes below the minimum", () => {
    expect(pinchView(start, { x: 0, y: 0 }, { x: 5, y: 0 }).zoom).toBe(ZOOM_MIN);
  });
  it("holds the view when fingers start on the same point", () => {
    const flat = beginPinch({ pan: { x: 4, y: 5 }, zoom: 1.2 }, { x: 10, y: 10 }, { x: 10, y: 10 });
    expect(pinchView(flat, { x: 10, y: 10 }, { x: 10, y: 10 })).toEqual({ pan: { x: 4, y: 5 }, zoom: 1.2 });
  });
});

describe("pan to pinch handoff", () => {
  it("produces no jump when the second finger lands mid-pan", () => {
    const livePan = panView({ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 160, y: 90 });
    const a = { x: 160, y: 90 };
    const b = { x: 260, y: 200 };
    const start = beginPinch({ pan: livePan, zoom: 0.72 }, a, b);
    const first = pinchView(start, a, b);
    expect(first.zoom).toBeCloseTo(0.72, 10);
    expect(first.pan.x).toBeCloseTo(livePan.x, 10);
    expect(first.pan.y).toBeCloseTo(livePan.y, 10);
  });

  it("produces no jump when one finger lifts back to a pan", () => {
    const view = { x: 37, y: -12 };
    expect(panView(view, { x: 80, y: 80 }, { x: 80, y: 80 })).toEqual(view);
  });
});
