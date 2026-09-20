import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { dragTo, keyTo, passedSlop, snapPoint } from "@/lib/canvas-drag";

const read = (path: string) => readFileSync(path, "utf8");

describe("pass 187 canvas drag", () => {
  it("snaps on both sides of the origin", () => {
    const snapped = snapPoint({ x: -40, y: 47 });
    expect(snapped.x).toBe(-44);
    expect(snapped.y % 22).toBe(0);
  });

  it("drops on the nearest grid square", () => {
    expect(dragTo({ x: 110, y: 110 }, { x: 5, y: 5 })).toEqual({ x: 110, y: 110 });
  });

  it("knows a click from a drag", () => {
    expect(passedSlop({ x: 3, y: 3 })).toBe(false);
    expect(passedSlop({ x: 10, y: 0 })).toBe(true);
  });

  it("moves by one square, or by the coarse step with shift", () => {
    expect(keyTo({ x: 0, y: 0 }, "ArrowRight", false).x).toBe(22);
    expect(keyTo({ x: 0, y: 0 }, "ArrowRight", true).x).toBe(110);
    expect(keyTo({ x: 0, y: 0 }, "ArrowLeft", false).x).toBe(-22);
  });

  it("persists position only, through the request scoped client", () => {
    const fns = read("src/lib/canvas-node.functions.ts");
    expect(fns).toContain("canvas.node_moved");
    expect(fns).not.toContain("supabaseAdmin");
    expect(fns).not.toContain("title");
    expect(fns).not.toContain("payload");
  });

  it("keeps the keyboard path and never touches membership", () => {
    const view = read("src/components/canvas/EngagementCanvasView.tsx");
    expect(view).toContain("aria-live");
    expect(view).toContain("Escape");
    expect(view).not.toContain("work_item_tasks");
    expect(view).not.toContain("visibility");
  });
});
