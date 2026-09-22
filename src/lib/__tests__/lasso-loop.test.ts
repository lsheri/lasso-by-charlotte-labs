import { describe, expect, it } from "vitest";

import {
  LOOP_CYCLE_MS,
  LOOP_DOTS,
  LOOP_SIZE_CHAT,
  LOOP_SIZE_TITLE,
  LOOP_SIZE_TOOLBAR,
  LOOP_STAMPS,
  cohesionAt,
  loopStamps,
  stampRadiusFor,
  turnFractionAt,
} from "@/lib/lasso-loop";

describe("Ask Lasso signature loop maths", () => {
  it("keeps cohesion continuous through every phase and across the cycle seam", () => {
    expect(cohesionAt(0)).toBe(0);
    expect(cohesionAt(0.4)).toBe(0);
    expect(cohesionAt(0.54)).toBe(1);
    expect(cohesionAt(0.7)).toBe(1);
    expect(cohesionAt(0.999999)).toBeCloseTo(cohesionAt(0), 4);

    const samples = Array.from({ length: 2001 }, (_, index) => cohesionAt(index / 2000));
    const largestStep = Math.max(
      ...samples.slice(1).map((value, index) => Math.abs(value - (samples[index] ?? value))),
    );
    expect(largestStep).toBeLessThan(0.02);
  });

  it("uses the named sizes and clamps the sublinear stamp radius at both ends", () => {
    const formula = (size: number) => 0.0275 * size * Math.pow(36 / size, 0.35);
    expect(stampRadiusFor(LOOP_SIZE_CHAT)).toBeCloseTo(formula(LOOP_SIZE_CHAT));
    expect(stampRadiusFor(LOOP_SIZE_TOOLBAR)).toBeCloseTo(formula(LOOP_SIZE_TOOLBAR));
    expect(stampRadiusFor(LOOP_SIZE_TITLE)).toBeCloseTo(formula(LOOP_SIZE_TITLE));
    expect(stampRadiusFor(1)).toBe(0.62);
    expect(stampRadiusFor(200)).toBe(1.6);
  });

  it("turns monotonically, closes continuously, and moves more slowly during hold than travel", () => {
    expect(turnFractionAt(0)).toBe(0);
    expect(turnFractionAt(0.4)).toBeCloseTo(0.72);
    expect(turnFractionAt(0.54)).toBeCloseTo(0.88);
    expect(turnFractionAt(0.7)).toBeCloseTo(0.9);
    expect(turnFractionAt(0.999999)).toBeCloseTo(1, 4);

    const samples = Array.from({ length: 2000 }, (_, index) => turnFractionAt(index / 2000));
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeGreaterThanOrEqual(samples[index - 1] ?? 0);
      expect((samples[index] ?? 0) - (samples[index - 1] ?? 0)).toBeLessThan(0.02);
    }

    const travelRate = (turnFractionAt(0.3) - turnFractionAt(0.1)) / 0.2;
    const holdRate = (turnFractionAt(0.66) - turnFractionAt(0.58)) / 0.08;
    expect(travelRate).toBeGreaterThan(holdRate);
  });

  it("is deterministic for identical time and size inputs", () => {
    const time = 0.61;
    expect(loopStamps(time, LOOP_SIZE_TOOLBAR)).toEqual(loopStamps(time, LOOP_SIZE_TOOLBAR));
  });

  it("moves the continuous stroke during travel", () => {
    const cycleSeconds = LOOP_CYCLE_MS / 1000;
    const earlier = loopStamps(cycleSeconds * 0.1, LOOP_SIZE_TOOLBAR);
    const later = loopStamps(cycleSeconds * 0.2, LOOP_SIZE_TOOLBAR);
    expect(cohesionAt(0.1)).toBe(0);
    expect(cohesionAt(0.2)).toBe(0);
    const travelDistances = earlier.map((stamp, index) => {
      const next = later[index];
      return next ? Math.hypot(next.x - stamp.x, next.y - stamp.y) : 0;
    });
    expect(Math.max(...travelDistances)).toBeGreaterThan(5);
  });

  it("closes its deterministic breath after the three-cycle super-period", () => {
    const time = (LOOP_CYCLE_MS / 1000) * 0.2;
    const superPeriodSeconds = (LOOP_CYCLE_MS / 1000) * 3;
    expect(loopStamps(time, LOOP_SIZE_TOOLBAR)).toEqual(
      loopStamps(time + superPeriodSeconds, LOOP_SIZE_TOOLBAR),
    );
  });

  it("returns 48 stamps and gathers them around five distinct centres", () => {
    const holdTime = (LOOP_CYCLE_MS / 1000) * 0.62;
    const stamps = loopStamps(holdTime, LOOP_SIZE_TOOLBAR);
    expect(LOOP_STAMPS).toBe(48);
    expect(stamps).toHaveLength(48);

    const centres = Array.from({ length: LOOP_DOTS }, (_, cluster) => {
      const members = stamps.filter((stamp) => stamp.cluster === cluster);
      const x = members.reduce((sum, stamp) => sum + stamp.x, 0) / members.length;
      const y = members.reduce((sum, stamp) => sum + stamp.y, 0) / members.length;
      expect(Math.max(...members.map((stamp) => Math.hypot(stamp.x - x, stamp.y - y)))).toBeLessThan(1.5);
      return `${x.toFixed(1)}:${y.toFixed(1)}`;
    });
    expect(new Set(centres)).toHaveLength(LOOP_DOTS);
  });
});