import { describe, expect, it } from "vitest";

import {
  EGRESS_BATCH_SIZE,
} from "../egress-shared";
import { EGRESS_POST_TIMEOUT_MS } from "../egress.server";
import {
  SWEEP_MIN_INTERVAL_MS,
  SWEEP_STALE_MS,
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
  it("refuses while a run is still in flight, past the interval but inside the stale window", () => {
    const state = createSweepState();
    expect(tryStartSweep(state, 0)).toBe(true);
    const during = Math.floor(1.5 * SWEEP_MIN_INTERVAL_MS); // past the interval, under SWEEP_STALE_MS
    expect(decideSweep(state, during)).toBe("already-running");
    expect(tryStartSweep(state, during)).toBe(false);
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

describe("pass 175 stale lock expiry", () => {
  it("exports a ten minute stale window", () => {
    expect(SWEEP_STALE_MS).toBe(600_000);
  });

  it("takes over a lock older than the stale window", () => {
    const state = createSweepState();
    tryStartSweep(state, 1_000);
    expect(decideSweep(state, 1_000 + SWEEP_STALE_MS)).toBe("run");
    expect(tryStartSweep(state, 1_000 + SWEEP_STALE_MS)).toBe(true);
    expect(state.lastStartedAt).toBe(1_000 + SWEEP_STALE_MS);
  });

  it("keeps a fresh lock as already-running", () => {
    const state = createSweepState();
    tryStartSweep(state, 1_000);
    expect(decideSweep(state, 1_000 + SWEEP_STALE_MS - 1)).toBe("already-running");
    expect(tryStartSweep(state, 1_000 + SWEEP_STALE_MS - 1)).toBe(false);
  });

  it("lets too-soon win when the lock is stale but the interval has not passed", () => {
    const state = createSweepState();
    tryStartSweep(state, 1_000, 20 * 60 * 1000);
    expect(decideSweep(state, 1_000 + SWEEP_STALE_MS, 20 * 60 * 1000)).toBe("too-soon");
  });
});

describe("pass 175 egress transport bounds", () => {
  it("keeps batches small enough for one post to finish", () => {
    expect(EGRESS_BATCH_SIZE).toBe(100);
  });

  it("gives the console thirty seconds to answer", () => {
    expect(EGRESS_POST_TIMEOUT_MS).toBe(30_000);
  });
});
