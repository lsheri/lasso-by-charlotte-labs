import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** QA F1: the Firm view event is written beside the counts, awaited with a cap, and never left to the host alone. */
const h = vi.hoisted(() => ({ event: vi.fn(), waitUntil: vi.fn() }));
vi.mock("@/lib/telemetry.server", () => ({ recordEvent: h.event, sha256Hex: async () => "hash" }));

const { buildFirmDashboardRecorded, FIRM_VIEW_EVENT_WAIT_MS } = await import("@/lib/firm-dashboard.server");
const background = await import("@/lib/background");
import type { FirmDashboard } from "@/lib/firm-dashboard-shared";

const admin = { admin: true } as never;
const dash = { panels_shown: 6 } as unknown as FirmDashboard;

beforeEach(() => {
  h.event.mockReset();
  h.waitUntil.mockReset();
  background.setRequestContext({ waitUntil: h.waitUntil });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  background.resetRequestContext();
});

describe("Firm view counts and their view event", () => {
  it("starts the event before the counts finish and has written it when it answers", async () => {
    let finish!: (value: FirmDashboard) => void;
    const build = vi.fn(() => new Promise<FirmDashboard>((resolve) => { finish = resolve; }));
    const written: string[] = [];
    h.event.mockImplementation(async () => { written.push("event"); });
    const answer = buildFirmDashboardRecorded(admin, "o1", "u1", build);
    await vi.waitFor(() => expect(h.event).toHaveBeenCalledTimes(1));
    expect(h.event).toHaveBeenCalledWith(admin, {
      eventType: "admin.dashboard_viewed",
      orgId: "o1",
      userId: "u1",
      dims: { panels_shown: 6 },
    });
    finish(dash);
    expect(await answer).toBe(dash);
    expect(written).toEqual(["event"]);
    // Handed to the host too, as a backstop.
    expect(h.waitUntil).toHaveBeenCalledTimes(1);
  });

  it("waits for a slow event only up to the cap, then answers and leaves the rest to the host", async () => {
    vi.useFakeTimers();
    h.event.mockImplementation(() => new Promise(() => {}));
    let answered = false;
    const answer = buildFirmDashboardRecorded(admin, "o1", "u1", async () => dash).then((value) => { answered = true; return value; });
    await vi.advanceTimersByTimeAsync(FIRM_VIEW_EVENT_WAIT_MS - 10);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(await answer).toBe(dash);
    expect(h.waitUntil).toHaveBeenCalledTimes(1);
  });

  it("answers the counts when the event fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.event.mockRejectedValue(new Error("insert failed"));
    expect(await buildFirmDashboardRecorded(admin, "o1", "u1", async () => dash)).toBe(dash);
  });

  it("still fails when the counts fail", async () => {
    h.event.mockResolvedValue(undefined);
    await expect(
      buildFirmDashboardRecorded(admin, "o1", "u1", async () => { throw new Error("counts failed"); }),
    ).rejects.toThrow("counts failed");
  });

  it("is what the server function answers with", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/lib/firm-dashboard.functions.ts", "utf8");
    const handler = source.slice(source.indexOf("export const getFirmDashboard"), source.indexOf("export const getFirmCheckLibrary"));
    expect(handler).toMatch(/return buildFirmDashboardRecorded\(supabaseAdmin, profile\.org_id, context\.userId\)/);
    expect(handler).not.toMatch(/recordEvent|runAfterResponse/);
  });
});

describe("runAlongside", () => {
  it("never rejects, even when the work throws at once", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(background.runAlongside(() => { throw new Error("boom"); }, 50)).resolves.toBeUndefined();
  });
});
