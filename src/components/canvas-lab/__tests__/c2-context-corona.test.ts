import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CONTEXT_CORONA_MOTION_CAP, contextCoronaMotionIds, contextCoronaPhase } from "../LabContextCoronas";
import type { LabNode } from "../canvas-lab-model";

const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");

function node(id: string, x: number, y: number): LabNode {
  return { id, kind: "judgment", frame: null, title: id, summary: id, typeLabel: "judgment", ownership: "draft", x, y, width: 232, height: 112 };
}

describe("C2 living context corona", () => {
  it("renders the corona layer before cards", () => {
    expect(page.indexOf("<LabContextCoronas")).toBeGreaterThan(-1);
    expect(page.indexOf("<LabContextCoronas")).toBeLessThan(page.indexOf("<LabCard key="));
  });

  it("caps moving coronas at twelve in reading order", () => {
    const nodes = Array.from({ length: 16 }, (_, index) => node(`n${index}`, (15 - index) % 4, Math.floor((15 - index) / 4)));
    const ids = contextCoronaMotionIds(nodes);
    expect(CONTEXT_CORONA_MOTION_CAP).toBe(12);
    expect(ids).toHaveLength(12);
    expect(ids.slice(0, 4)).toEqual(["n15", "n14", "n13", "n12"]);
  });

  it("keeps a stable per-card phase offset", () => {
    expect(contextCoronaPhase("alpha")).toBe(contextCoronaPhase("alpha"));
    expect(contextCoronaPhase("alpha")).not.toBe(contextCoronaPhase("beta"));
    expect(contextCoronaPhase("alpha")).toBeLessThanOrEqual(0);
    expect(contextCoronaPhase("alpha")).toBeGreaterThan(-13000);
  });

  it("marks pointer, drawing, wheel-pan, and zoom movement as interacting", () => {
    expect(page).toContain('interaction !== "idle" || drawing !== null || viewportMoving');
    expect(page).toContain("pauseCoronasForViewportMotion();");
  });
});