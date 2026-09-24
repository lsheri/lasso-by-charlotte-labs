import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CONTEXT_CORONA_EXIT_MS,
  CONTEXT_CORONA_MOTION_CAP,
  CORONA_LOOK,
  contextCoronaAge,
  contextCoronaFade,
  contextCoronaMotionIds,
  contextCoronaPhase,
  contextCoronaSeed,
  coronaLook,
  coronaLookRect,
  coronaScreenRect,
  coronaTouchesViewport,
} from "../LabContextCoronas";
import type { LabNode } from "../canvas-lab-model";

const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");

function node(id: string, x: number, y: number): LabNode {
  return { id, kind: "judgment", frame: null, title: id, summary: id, typeLabel: "judgment", ownership: "draft", x, y, width: 232, height: 112 };
}

describe("C3 WebGL context corona", () => {
  it("renders the corona layer before cards", () => {
    expect(page.indexOf("<LabContextCoronas")).toBeGreaterThan(-1);
    expect(page.indexOf("<LabContextCoronas")).toBeLessThan(page.indexOf("<LabCard key="));
  });

  it("caps shader coronas at twelve in reading order", () => {
    const nodes = Array.from({ length: 16 }, (_, index) => node(`n${index}`, (15 - index) % 4, Math.floor((15 - index) / 4)));
    const ids = contextCoronaMotionIds(nodes);
    expect(CONTEXT_CORONA_MOTION_CAP).toBe(12);
    expect(ids).toHaveLength(12);
    expect(ids.slice(0, 4)).toEqual(["n15", "n14", "n13", "n12"]);
  });

  it("keeps a stable phase and seed per card id", () => {
    expect(contextCoronaPhase("alpha")).toBe(contextCoronaPhase("alpha"));
    expect(contextCoronaPhase("alpha")).not.toBe(contextCoronaPhase("beta"));
    expect(contextCoronaSeed("alpha")).toBe(contextCoronaSeed("alpha"));
    expect(contextCoronaSeed("alpha")).not.toBe(contextCoronaSeed("beta"));
  });

  it("clamps the shader look scale", () => {
    expect(coronaLook(0.2)).toBe(0.5);
    expect(coronaLook(0.84)).toBe(0.84);
    expect(coronaLook(2)).toBe(1.45);
  });

  it("uses measured height in screen and look rect maths", () => {
    const screen = coronaScreenRect(node("a", 20, 30), { x: 5, y: -10 }, 2, 180);
    expect(screen).toEqual({ x: 45, y: 50, width: 464, height: 360 });
    expect(coronaLookRect(screen, 0.5)).toEqual({ x: 90, y: 100, width: 928, height: 720 });
  });

  it("culls only cards outside the grown viewport", () => {
    const viewport = { width: 1000, height: 700 };
    expect(coronaTouchesViewport({ x: 1020, y: 100, width: 200, height: 100 }, viewport, 1)).toBe(true);
    expect(coronaTouchesViewport({ x: 1300, y: 100, width: 200, height: 100 }, viewport, 1)).toBe(false);
  });

  it("starts loaded cards settled and delayed cards with negative age", () => {
    const now = 10;
    expect(contextCoronaAge(now, now - 5, false)).toBe(5);
    expect(contextCoronaAge(now, now + 0.4, false)).toBeCloseTo(-0.4);
    expect(contextCoronaAge(now, now + 0.4, true)).toBe(5);
  });

  it("fades from one to zero over 200ms", () => {
    expect(CONTEXT_CORONA_EXIT_MS).toBe(200);
    expect(contextCoronaFade(10, undefined)).toBe(1);
    expect(contextCoronaFade(10, 10)).toBe(1);
    expect(contextCoronaFade(10.1, 10)).toBeCloseTo(0.5);
    expect(contextCoronaFade(10.2, 10)).toBe(0);
  });

  it("uses Liam's approved shader settings", () => {
    expect(CORONA_LOOK).toEqual({ reach: 33, speed: 0.6, heat: 1.07, wisp: 0.89 });
  });

  it("marks pointer, drawing, wheel-pan, and zoom movement as interacting", () => {
    expect(page).toContain('interaction !== "idle" || drawing !== null || viewportMoving');
    expect(page).toContain("pauseCoronasForViewportMotion();");
  });
});

import { readFileSync as readC31 } from "node:fs";
import { coronaLeaveFade, contextCoronaFade as fadeC31 } from "@/components/canvas-lab/LabContextCoronas";

describe("Pass C3.1", () => {
  const src = readC31("src/components/canvas-lab/LabContextCoronas.tsx", "utf8");
  it("fades on wall-clock seconds over 200ms", () => {
    expect(fadeC31(10, 10)).toBe(1);
    expect(fadeC31(10.1, 10)).toBeCloseTo(0.5);
    expect(fadeC31(10.2, 10)).toBe(0);
    expect(coronaLeaveFade(10.1, 10, false)).toBeCloseTo(0.5);
    expect(src).toMatch(/entry\.leftAt = wallNow\(\)/);
  });
  it("a still-mode leave has no fade", () => {
    expect(coronaLeaveFade(10, 10, true)).toBe(0);
    expect(coronaLeaveFade(10, undefined, true)).toBe(1);
  });
  it("does not read computed style inside draw", () => {
    const body = src.slice(src.indexOf("const draw = "), src.indexOf("const needsLoop"));
    expect(body).not.toContain("getComputedStyle");
  });
  it("loses the context only behind the alive check", () => {
    expect(src).toMatch(/if \(!aliveRef\.current\) lose\(\)/);
    expect(src).toMatch(/if \(aliveRef\.current\) unavailableRef\.current = true/);
  });
});
