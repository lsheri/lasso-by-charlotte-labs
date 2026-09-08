import { describe, expect, it } from "vitest";

import {
  SWEEP_MIN_INTERVAL_MS,
  createSweepState,
  decideSweep,
  releaseSweep,
  tryStartSweep,
} from "../sweep-guard";

describe("pass 173 sweep rate guard", () => {
  it("waits several minutes between runs", () => {
    expect(SWEEP_MIN_INTERVAL_MS).toBe(300_000);
  });

  it("allows the first call", () => {
    const state = createSweepState();
    expect(decideSweep(state, 1_000)).toBe("run");
    expect(tryStartSweep(state, 1_000)).toBe(true);
  });

  it("refuses a second call inside the window", () => {
    const state = createSweepState();
    tryStartSweep(state, 1_000);
    releaseSweep(state);
    expect(decideSweep(state, 1_000 + SWEEP_MIN_INTERVAL_MS - 1)).toBe("too-soon");
    expect(tryStartSweep(state, 1_000 + SWEEP_MIN_INTERVAL_MS - 1)).toBe(false);
  });

  it("allows a call once the window has passed", () => {
    const state = createSweepState();
    tryStartSweep(state, 1_000);
    releaseSweep(state);
    expect(tryStartSweep(state, 1_000 + SWEEP_MIN_INTERVAL_MS)).toBe(true);
  });
});

describe("pass 173 no concurrent run", () => {
  it("refuses while a run is still in flight, even long after the window", () => {
    const state = createSweepState();
    expect(tryStartSweep(state, 0)).toBe(true);
    expect(decideSweep(state, 10 * SWEEP_MIN_INTERVAL_MS)).toBe("already-running");
    expect(tryStartSweep(state, 10 * SWEEP_MIN_INTERVAL_MS)).toBe(false);
  });

  it("only one of many simultaneous callers claims the slot", () => {
    const state = createSweepState();
    const claims = [0, 0, 0, 0, 0].map(() => tryStartSweep(state, 5_000));
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("accepts a new run after release and the window", () => {
    const state = createSweepState();
    tryStartSweep(state, 0);
    releaseSweep(state);
    expect(state.running).toBe(false);
    expect(tryStartSweep(state, SWEEP_MIN_INTERVAL_MS)).toBe(true);
  });

  it("honours a custom interval", () => {
    const state = createSweepState();
    tryStartSweep(state, 0, 1_000);
    releaseSweep(state);
    expect(tryStartSweep(state, 500, 1_000)).toBe(false);
    expect(tryStartSweep(state, 1_000, 1_000)).toBe(true);
  });
});
