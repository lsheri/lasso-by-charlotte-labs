import { describe, expect, it } from "vitest";

import {
  LOOP_CYCLE_MS,
  LOOP_DOTS,
  LOOP_SEQUENCE_LENGTH,
  LOOP_SIZE_CHAT,
  LOOP_SIZE_TITLE,
  LOOP_SIZE_TOOLBAR,
  LOOP_STAMPS,
  cohesionAt,
  loopStamps,
  motionPhaseAt,
  resolvedLinework,
  resolvedFormAt,
  settledLassoStamps,
  stampRadiusFor,
  turnFractionAt,
} from "@/lib/lasso-loop";

describe("Ask Lasso signature loop maths", () => {
  it("keeps cohesion continuous through every phase and across the cycle seam", () => {
    expect(cohesionAt(0)).toBe(0);
    expect(cohesionAt(0.54)).toBe(0);
    expect(cohesionAt(0.7)).toBe(1);
    expect(cohesionAt(0.88)).toBe(1);
    expect(cohesionAt(0.999999)).toBeCloseTo(cohesionAt(0), 4);

    const samples = Array.from({ length: 2001 }, (_, index) => cohesionAt(index / 2000));
    const largestStep = Math.max(
      ...samples.slice(1).map((value, index) => Math.abs(value - (samples[index] ?? value))),
    );
    expect(largestStep).toBeLessThan(0.02);
  });

  it("uses the named sizes and clamps the sublinear stamp radius at both ends", () => {
    const formula = (size: number) => 0.029 * size * Math.pow(36 / size, 0.38);
    expect(stampRadiusFor(LOOP_SIZE_CHAT)).toBeCloseTo(formula(LOOP_SIZE_CHAT));
    expect(stampRadiusFor(LOOP_SIZE_TOOLBAR)).toBeCloseTo(formula(LOOP_SIZE_TOOLBAR));
    expect(stampRadiusFor(LOOP_SIZE_TITLE)).toBeCloseTo(formula(LOOP_SIZE_TITLE));
    expect(stampRadiusFor(1)).toBe(0.62);
    expect(stampRadiusFor(200)).toBe(1.72);
  });

  it("turns monotonically, closes continuously, and moves more slowly during hold than travel", () => {
    expect(turnFractionAt(0)).toBe(0);
    expect(turnFractionAt(0.18)).toBeCloseTo(0.12);
    expect(turnFractionAt(0.34)).toBeCloseTo(0.3);
    expect(turnFractionAt(0.54)).toBeCloseTo(0.58);
    expect(turnFractionAt(0.88)).toBeCloseTo(0.66);
    expect(turnFractionAt(0.999999)).toBeCloseTo(1, 4);

    const samples = Array.from({ length: 2000 }, (_, index) => turnFractionAt(index / 2000));
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeGreaterThanOrEqual(samples[index - 1] ?? 0);
      expect((samples[index] ?? 0) - (samples[index - 1] ?? 0)).toBeLessThan(0.02);
    }

    const travelRate = (turnFractionAt(0.5) - turnFractionAt(0.36)) / 0.14;
    const holdRate = (turnFractionAt(0.84) - turnFractionAt(0.74)) / 0.1;
    expect(travelRate).toBeGreaterThan(holdRate);
  });

  it("moves from clock face through horizon and loose orbit before resolving as Lasso", () => {
    expect(motionPhaseAt(0.1)).toBe("clock");
    expect(motionPhaseAt(0.25)).toBe("horizon");
    expect(motionPhaseAt(0.5)).toBe("loose");
    expect(motionPhaseAt(0.8)).toBe("lasso");
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

  it("starts with the cursive L, advances through four symbols and the fox, then repeats", () => {
    const cycleSeconds = LOOP_CYCLE_MS / 1000;
    expect(LOOP_SEQUENCE_LENGTH).toBe(6);
    expect(Array.from({ length: 12 }, (_, index) => resolvedFormAt(cycleSeconds * index))).toEqual([
      0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5,
    ]);

    const silhouettes = Array.from({ length: LOOP_SEQUENCE_LENGTH }, (_, form) =>
      settledLassoStamps(LOOP_SIZE_TITLE, form as 0 | 1 | 2 | 3 | 4 | 5)
        .map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join("|"),
    );
    expect(new Set(silhouettes).size).toBe(LOOP_SEQUENCE_LENGTH);
  });

  it("returns 48 stamps and resolves every form inside its square", () => {
    const holdTime = (LOOP_CYCLE_MS / 1000) * 0.8;
    const stamps = loopStamps(holdTime, LOOP_SIZE_TOOLBAR);
    expect(LOOP_STAMPS).toBe(48);
    expect(stamps).toHaveLength(48);
    const still = settledLassoStamps(LOOP_SIZE_TOOLBAR);
    expect(still).toHaveLength(LOOP_STAMPS);
    stamps.forEach((stamp, index) => {
      const target = still[index];
      expect(target).toBeDefined();
      expect(stamp.x).toBeCloseTo(target?.x ?? 0, 10);
      expect(stamp.y).toBeCloseTo(target?.y ?? 0, 10);
    });
    for (const size of [LOOP_SIZE_CHAT, LOOP_SIZE_TOOLBAR, 56, LOOP_SIZE_TITLE]) {
      for (const form of [0, 1, 2, 3, 4, 5] as const) {
        expect(settledLassoStamps(size, form).every(({ x, y }) => x >= 0 && x <= size && y >= 0 && y <= size)).toBe(true);
      }
    }
  });

  it("provides connected final linework for every resolved form", () => {
    for (const form of [0, 1, 2, 3, 4, 5] as const) {
      const paths = resolvedLinework(LOOP_SIZE_TITLE, form);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.some(({ points }) => points.length > 10)).toBe(true);
      expect(paths.flatMap(({ points }) => points).every(({ x, y }) =>
        x >= 0 && x <= LOOP_SIZE_TITLE && y >= 0 && y <= LOOP_SIZE_TITLE
      )).toBe(true);
    }
  });

  it("compresses into a horizon and loosens asymmetrically without leaving its square", () => {
    const cycleSeconds = LOOP_CYCLE_MS / 1000;
    const horizon = loopStamps(cycleSeconds * 0.29, LOOP_SIZE_TITLE);
    const loose = loopStamps(cycleSeconds * 0.48, LOOP_SIZE_TITLE);
    const spreadY = (points: typeof horizon) => Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
    expect(spreadY(horizon)).toBeLessThan(LOOP_SIZE_TITLE * 0.22);
    expect(spreadY(loose)).toBeGreaterThan(spreadY(horizon) * 2);
    expect(loose.every((point) => point.x > 0 && point.x < LOOP_SIZE_TITLE && point.y > 0 && point.y < LOOP_SIZE_TITLE)).toBe(true);
  });
});