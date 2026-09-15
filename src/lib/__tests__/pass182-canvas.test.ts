import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CANVAS_GRID, seedLayout } from "@/lib/canvas-layout";

const read = (path: string) => readFileSync(path, "utf8");

describe("pass 182 canvas", () => {
  const input = {
    deliverables: ["d1", "d2"],
    linksBySource: new Map([
      ["s1", ["d1"]],
      ["s2", ["d2"]],
    ]),
  };

  it("seeds deterministically", () => {
    expect(seedLayout(input)).toEqual(seedLayout(input));
  });

  it("leaves unlinked items off the canvas", () => {
    expect(seedLayout(input).some((node) => node.id === "unlinked")).toBe(false);
  });

  it("snaps every coordinate to the grid", () => {
    for (const node of seedLayout(input)) {
      expect(node.x % CANVAS_GRID).toBe(0);
      expect(node.y % CANVAS_GRID).toBe(0);
    }
  });

  it("keeps successive deliverables one snapped 260px step apart", () => {
    const deliverables = seedLayout(input).filter((node) => node.kind === "deliverable");
    expect(deliverables[1]?.y).toBe(Math.round((80 + 260) / CANVAS_GRID) * CANVAS_GRID);
  });

  it("registers a content-free canvas opening event", () => {
    expect(read("src/lib/telemetry-shared.ts")).toContain('| "canvas.opened"');
    const functions = read("src/lib/canvas.functions.ts");
    expect(functions).toContain("canvas.opened");
    expect(functions).not.toContain("title");
    expect(functions).not.toContain("payload");
  });

  it("replaces the Verify presentation", () => {
    const page = read("src/pages/EngagementPage.tsx");
    expect(page).toContain("CANVAS");
    expect(page).toContain("what fed what?");
    expect(page).not.toContain("NOTHING TO CHECK YET");
  });
});