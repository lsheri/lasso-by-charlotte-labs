import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EGRESS_NUDGE_INTERVAL_MS, shouldNudgeEgress } from "../egress-nudge";

const contentEgress = vi.fn(async () => ({ sent: 0, skipped: 0, failed: 0 }));

vi.mock("../content-egress.server", () => ({
  runContentEgress: () => contentEgress(),
}));

const savedSecret = process.env["LASSO_DATA_INGEST_SECRET"];

describe("pass 175b: awaited sweep home", () => {
  beforeEach(() => {
    vi.resetModules();
    contentEgress.mockClear();
    // No secret: the sending half stops before it reads anything, so the test
    // exercises the guard and nothing leaves the machine.
    delete process.env["LASSO_DATA_INGEST_SECRET"];
  });

  afterEach(() => {
    if (savedSecret !== undefined) process.env["LASSO_DATA_INGEST_SECRET"] = savedSecret;
  });

  async function loadModule() {
    const mod = await import("../egress.server");
    mod.resetEgressSchedule();
    return mod;
  }

  it("runs when the guard grants the slot", async () => {
    const mod = await loadModule();
    const result = await mod.runGuardedSweepNow(1_000_000);
    expect(result.status).toBe("ran");
    if (result.status === "ran") {
      expect(result.events).toEqual({ sent: 0, skipped: 0, failed: 0 });
      expect(result.samples).toEqual({ sent: 0, skipped: 0, failed: 0 });
    }
    expect(contentEgress).toHaveBeenCalledTimes(1);
  });

  it("skips as too-soon inside the interval", async () => {
    const mod = await loadModule();
    await mod.runGuardedSweepNow(1_000_000);
    const again = await mod.runGuardedSweepNow(1_000_000 + 60_000);
    expect(again).toEqual({ status: "skipped", reason: "too-soon" });
    expect(contentEgress).toHaveBeenCalledTimes(1);
  });

  it("skips as already-running while a run holds the slot", async () => {
    const mod = await loadModule();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    contentEgress.mockImplementation(async () => {
      await held;
      return { sent: 0, skipped: 0, failed: 0 };
    });
    const first = mod.runGuardedSweepNow(2_000_000);
    await Promise.resolve();
    const second = await mod.runGuardedSweepNow(2_000_100);
    expect(second).toEqual({ status: "skipped", reason: "already-running" });
    release();
    await first;
    contentEgress.mockImplementation(async () => ({ sent: 0, skipped: 0, failed: 0 }));
  });


  it("releases the slot even when the sweep fails", async () => {
    const mod = await loadModule();
    contentEgress.mockRejectedValueOnce(new Error("boom") as never);
    await expect(mod.runGuardedSweepNow(3_000_000)).rejects.toThrow("boom");
    const next = await mod.runGuardedSweepNow(3_000_100);
    expect(next).toEqual({ status: "skipped", reason: "too-soon" });
  });
});

describe("pass 175b: browser nudge throttle", () => {
  it("nudges when nothing has been recorded", () => {
    expect(shouldNudgeEgress(null, 1_000)).toBe(true);
    expect(shouldNudgeEgress("", 1_000)).toBe(true);
    expect(shouldNudgeEgress("not-a-number", 1_000)).toBe(true);
  });

  it("holds off inside ten minutes and allows after", () => {
    const now = 10_000_000;
    expect(shouldNudgeEgress(String(now - 60_000), now)).toBe(false);
    expect(shouldNudgeEgress(String(now - EGRESS_NUDGE_INTERVAL_MS + 1), now)).toBe(false);
    expect(shouldNudgeEgress(String(now - EGRESS_NUDGE_INTERVAL_MS), now)).toBe(true);
    expect(shouldNudgeEgress(now - EGRESS_NUDGE_INTERVAL_MS * 2, now)).toBe(true);
  });
});
