import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordAnonymousEvent = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("@/lib/telemetry.server", () => ({
  recordAnonymousEvent: (...a: unknown[]) => (recordAnonymousEvent as (...x: unknown[]) => unknown)(...a),
  recordEvent: vi.fn(async () => undefined),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

import { recordAuthFailure, resetAuthFailureThrottle } from "@/lib/mcp-handler.server";
import { guardEventDims } from "@/lib/event-dim-allowlist";

describe("TEL-2 mcp.auth_failed throttle", () => {
  beforeEach(() => {
    resetAuthFailureThrottle();
    recordAnonymousEvent.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("writes one row per key per 60s with a banded repeat count", async () => {
    for (let i = 0; i < 30; i++) {
      await recordAuthFailure({ kind: "header", reason: "bad_key" });
      vi.advanceTimersByTime(1000);
    }
    expect(recordAnonymousEvent).toHaveBeenCalledTimes(1);
    expect(recordAnonymousEvent.mock.calls[0]?.[2]).toEqual({ kind: "header", reason: "bad_key", repeats_band: "0" });

    vi.advanceTimersByTime(61_000);
    await recordAuthFailure({ kind: "header", reason: "bad_key" });
    expect(recordAnonymousEvent).toHaveBeenCalledTimes(2);
    expect(recordAnonymousEvent.mock.calls[1]?.[2]).toEqual({ kind: "header", reason: "bad_key", repeats_band: "11-50" });

    await recordAuthFailure({ kind: "header", reason: "no_connection" });
    expect(recordAnonymousEvent).toHaveBeenCalledTimes(3);
    expect(recordAnonymousEvent.mock.calls[2]?.[2]).toEqual({ kind: "header", reason: "no_connection", repeats_band: "0" });
  });

  it("allowlist admits repeats_band and drops unlisted keys", () => {
    const { dims } = guardEventDims("mcp.auth_failed", { kind: "link", reason: "bad_token", repeats_band: "1-10", token: "x" });
    expect(dims).toEqual({ kind: "link", reason: "bad_token", repeats_band: "1-10" });
  });
});
