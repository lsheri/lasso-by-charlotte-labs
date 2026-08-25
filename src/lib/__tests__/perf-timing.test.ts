import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("../telemetry", () => ({ logEvent: vi.fn() }));

import { logEvent } from "../telemetry";
import {
  PERF_NAMES,
  emitPerfInteraction,
  markOpenStart,
  resetPerfCoalescing,
  startPerfTimer,
  takeOpenStart,
  clearOpenStarts,
} from "../perf-timing";

const emitted = logEvent as unknown as ReturnType<typeof vi.fn>;

const identity = { orgId: "org-1", surface: "owner" as const };

beforeEach(() => {
  emitted.mockClear();
  resetPerfCoalescing();
  clearOpenStarts();
});

describe("perf.interaction emit guarantee", () => {
  it("writes exactly the five allowed dims", () => {
    expect(
      emitPerfInteraction({
        ...identity,
        name: "peek.open",
        phase: "total",
        state: "cold",
        durationMs: 120.6,
      }),
    ).toBe(true);
    expect(emitted).toHaveBeenCalledWith("perf.interaction", "org-1", {
      name: "peek.open",
      duration_ms: 121,
      phase: "total",
      surface: "owner",
      state: "cold",
    });
  });

  it("drops any extra key a caller supplies", () => {
    emitPerfInteraction({
      ...identity,
      name: "peek.open",
      phase: "total",
      state: "warm",
      durationMs: 10,
      // A careless caller: neither of these may ever reach the pipeline.
      title: "Q3 board deck",
      work_item_id: "b2c3",
    } as never);
    const dims = emitted.mock.calls[0]![2] as Record<string, unknown>;
    expect(Object.keys(dims).sort()).toEqual([
      "duration_ms",
      "name",
      "phase",
      "state",
      "surface",
    ]);
    expect(dims["title"]).toBeUndefined();
    expect(dims["work_item_id"]).toBeUndefined();
  });

  it("emits nothing for a name outside the frozen vocabulary", () => {
    expect(
      emitPerfInteraction({
        ...identity,
        name: "something.new" as never,
        phase: "total",
        state: "cold",
        durationMs: 5,
      }),
    ).toBe(false);
    expect(emitted).not.toHaveBeenCalled();
  });

  it("keeps duration_ms exact and clamps the absurd", () => {
    emitPerfInteraction({ ...identity, name: "canvas.open", phase: "total", state: "cold", durationMs: -4 });
    emitPerfInteraction({
      ...identity,
      name: "audit.open",
      phase: "total",
      state: "cold",
      durationMs: 9_999_999,
    });
    expect((emitted.mock.calls[0]![2] as { duration_ms: number }).duration_ms).toBe(0);
    expect((emitted.mock.calls[1]![2] as { duration_ms: number }).duration_ms).toBe(120_000);
  });

  it("emits nothing without an org", () => {
    emitPerfInteraction({
      orgId: null,
      surface: "coach",
      name: "canvas.open",
      phase: "total",
      state: "cold",
      durationMs: 12,
    });
    expect(emitted).not.toHaveBeenCalled();
  });

  it("coalesces repeated paint emits inside the window, never other phases", () => {
    const paint = { ...identity, name: "workstream.drag_remap" as const, phase: "paint" as const, state: "warm" as const, durationMs: 20 };
    expect(emitPerfInteraction(paint)).toBe(true);
    expect(emitPerfInteraction(paint)).toBe(false);
    expect(emitPerfInteraction({ ...paint, phase: "write" })).toBe(true);
    expect(emitPerfInteraction({ ...paint, phase: "write" })).toBe(true);
  });

  it("carries the coach surface through unchanged", () => {
    emitPerfInteraction({
      orgId: "org-2",
      surface: "coach",
      name: "engagement.load",
      phase: "total",
      state: "warm",
      durationMs: 40,
    });
    expect((emitted.mock.calls[0]![2] as { surface: string }).surface).toBe("coach");
  });
});

describe("timers", () => {
  it("emits one row per phase and ignores marks after done", () => {
    const timer = startPerfTimer("workstream.drag_remap", identity, "warm");
    timer.mark("write");
    timer.mark("refetch");
    timer.done("total");
    timer.mark("write");
    expect(emitted).toHaveBeenCalledTimes(3);
    expect(emitted.mock.calls.map((call) => (call[2] as { phase: string }).phase)).toEqual([
      "write",
      "refetch",
      "total",
    ]);
  });

  it("cancel emits nothing", () => {
    const timer = startPerfTimer("lasso.resolve", identity, "warm");
    timer.cancel();
    timer.done();
    expect(emitted).not.toHaveBeenCalled();
  });

  it("is inert without an org", () => {
    const timer = startPerfTimer("canvas.open", { orgId: null, surface: "owner" }, "cold");
    timer.done();
    expect(emitted).not.toHaveBeenCalled();
  });

  it("consumes an open start once", () => {
    markOpenStart("audit.open");
    expect(takeOpenStart("audit.open")).not.toBeNull();
    expect(takeOpenStart("audit.open")).toBeNull();
  });

  it("holds nine names and no more", () => {
    expect(PERF_NAMES).toHaveLength(9);
    expect(Object.isFrozen(PERF_NAMES)).toBe(true);
  });
});
