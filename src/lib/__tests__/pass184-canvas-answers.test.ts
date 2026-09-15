import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const canvas = readFileSync("src/components/canvas/EngagementCanvasView.tsx", "utf8");
const lineage = readFileSync("src/lib/lineage.functions.ts", "utf8");
const telemetry = readFileSync("src/lib/telemetry-shared.ts", "utf8");

describe("pass 184 · answering a drafted line on the canvas", () => {
  it("reviews through the existing server function, from the canvas", () => {
    expect(canvas).toContain('surface: "canvas"');
  });

  it("uses the existing two answers, word for word", () => {
    expect(canvas).toContain("Yes, this fed it");
    expect(canvas).toContain("No it didn");
  });

  it("gives a draft line a hit area wide enough to press", () => {
    expect(canvas).toContain('pointerEvents="stroke"');
    expect(canvas).toContain("strokeWidth={18}");
  });

  it("says how many questions are waiting", () => {
    expect(canvas).toContain("question");
    expect(canvas).toContain("to answer");
  });

  it("never opens the control on hover", () => {
    expect(canvas).not.toMatch(/hit[^\n]*onMouseEnter/i);
  });

  it("leaves the review server function in shape", () => {
    expect(lineage).toContain('eventType: "link.reviewed"');
    expect(lineage).toContain('surface: data.surface ?? "peek"');
  });

  it("introduces no new event name", () => {
    expect(telemetry).not.toContain("canvas.link");
  });
});
