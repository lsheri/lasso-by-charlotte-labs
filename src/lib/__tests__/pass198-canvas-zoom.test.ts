import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  pinchZoom,
  stepZoom,
} from "../canvas-zoom";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("pass 198 — zooming the canvas", () => {
  it("clampZoom holds both ends of the range", () => {
    expect(clampZoom(9)).toBe(ZOOM_MAX);
    expect(clampZoom(0.01)).toBe(ZOOM_MIN);
    expect(clampZoom(1)).toBe(1);
  });

  it("stepZoom never leaves the range", () => {
    expect(stepZoom(ZOOM_MAX, "in")).toBe(ZOOM_MAX);
    expect(stepZoom(ZOOM_MIN, "out")).toBe(ZOOM_MIN);
  });

  it("pinchZoom moves the right way for either delta", () => {
    expect(pinchZoom(1, -100)).toBeGreaterThan(1);
    expect(pinchZoom(1, 100)).toBeLessThan(1);
  });

  it("the canvas divides pointer measures by the zoom before canvas maths", () => {
    const source = read("src/components/canvas/EngagementCanvasView.tsx");
    const dragAt = source.indexOf("dragTo({ x: origin.x, y: origin.y }, delta)");
    expect(dragAt).toBeGreaterThan(-1);
    expect(source.slice(Math.max(0, dragAt - 900), dragAt)).toContain("/ zoom");
    const nearestAt = source.indexOf("nearestTarget(point, candidates)");
    expect(nearestAt).toBeGreaterThan(-1);
    expect(source.slice(Math.max(0, nearestAt - 1200), nearestAt)).toContain("/ zoom");
  });

  it("canvas-zoom.ts stays pure", () => {
    const source = read("src/lib/canvas-zoom.ts");
    expect(source).not.toContain("logEvent");
    expect(source).not.toContain("from \"react\"");
  });
});
