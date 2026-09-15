import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { canLink, handlePoints, nearestTarget } from "@/lib/canvas-link";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("pass196 canvas link rules", () => {
  it("refuses a self link", () => {
    expect(canLink("a", "a", [])).toBeTruthy();
  });

  it("refuses a pair that already has a confirmed row with the same relation", () => {
    expect(
      canLink("a", "b", [
        { from_item_id: "a", to_item_id: "b", relation: "informed", status: "confirmed" },
      ]),
    ).toBeTruthy();
  });

  it("allows a pair whose only row is discarded", () => {
    expect(
      canLink("a", "b", [
        { from_item_id: "a", to_item_id: "b", relation: "informed", status: "discarded" },
      ]),
    ).toBeNull();
  });

  it("returns four handle points with the top above the bottom", () => {
    const points = handlePoints({ x: 10, y: 20, w: 100, h: 60 });
    expect(points).toHaveLength(4);
    expect(points[0]!.y).toBeLessThan(points[2]!.y);
  });

  it("returns no target when the point is far from every candidate", () => {
    expect(
      nearestTarget({ x: 900, y: 900 }, [{ id: "a", x: 0, y: 0, w: 100, h: 60 }]),
    ).toBeNull();
  });
});

describe("pass196 write path", () => {
  const source = read("src/lib/canvas-link.functions.ts");

  it("resolves the acting profile", () => {
    expect(source).toContain("resolveProfile");
  });

  it("never uses the admin client", () => {
    expect(source).not.toContain("supabaseAdmin");
  });

  it("never lands in the model-accuracy metric", () => {
    expect(source).not.toContain("recordEventV2");
  });

  it("does not use upsert", () => {
    expect(source).not.toContain("upsert");
  });

  it("does not use onConflict", () => {
    expect(source).not.toContain("onConflict");
  });

  it("assigns source: person exactly once, on creation only", () => {
    const matches = source.match(/source: "person"/g);
    expect(matches).toHaveLength(1);
  });
});

describe("pass196 lineage guards", () => {
  const source = read("src/lib/lineage.functions.ts");

  it("guards the model-accuracy metric on model edges", () => {
    expect(source).toContain('source === "model"');
  });

  it("requires source on the non-owner branch", () => {
    expect(source).toMatch(/isOwner[\s\S]{0,200}source/);
  });
});
