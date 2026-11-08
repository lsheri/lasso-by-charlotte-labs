// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StatusCb = (status: string) => void;
const realtime = vi.hoisted(() => ({ status: null as StatusCb | null, removed: 0 }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => {
      const channel = {
        on: () => channel,
        subscribe: (cb: StatusCb) => { realtime.status = cb; return channel; },
      };
      return channel;
    },
    removeChannel: async () => { realtime.removed += 1; },
  },
}));

import { BOARD_LIVE_DOWN_GRACE_MS, BOARD_LIVE_FALLBACK_POLL_MS, offlineDurationBand, useBoardLive, type BoardConnection } from "@/components/canvas-lab/board-live";
import { BOARD_OFFLINE_COPY, BoardOfflineBanner } from "@/components/canvas-lab/BoardOfflineBanner";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}

function mount(refresh: () => Promise<boolean>) {
  const states: BoardConnection[] = [];
  const hook = renderHook(() => useBoardLive({ boardId: "b1", enabled: true, known: () => new Map(), isBusy: () => false, refresh, onConnection: (state) => states.push(state) }));
  return { states, hook };
}

beforeEach(() => { vi.useFakeTimers(); setOnline(true); realtime.status = null; });
afterEach(() => { vi.useRealTimers(); });

describe("LIVE-2 the connection state", () => {
  it("live updates blocked but the server answers: stays editable and re-reads on a timer", async () => {
    const refresh = vi.fn(async () => false);
    const { states } = mount(refresh);
    act(() => realtime.status?.("CHANNEL_ERROR"));
    await act(async () => { await vi.advanceTimersByTimeAsync(BOARD_LIVE_DOWN_GRACE_MS + 400); });
    expect(refresh).toHaveBeenCalledWith("reconnect");
    expect(states.some((state) => state.offline)).toBe(false);
    const calls = refresh.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(BOARD_LIVE_FALLBACK_POLL_MS + 400); });
    expect(refresh.mock.calls.length).toBeGreaterThan(calls);
  });

  it("live updates down and the server does not answer: offline", async () => {
    const refresh = vi.fn(async () => { throw new Error("unreachable"); });
    const { states } = mount(refresh);
    act(() => realtime.status?.("TIMED_OUT"));
    await act(async () => { await vi.advanceTimersByTimeAsync(BOARD_LIVE_DOWN_GRACE_MS + 400); });
    expect(states.at(-1)?.offline).toBe(true);
    expect(states.at(-1)?.offlineSince).not.toBeNull();
  });

  it("coming back online re-reads first, then clears offline", async () => {
    let reachable = false;
    const refresh = vi.fn(async () => { if (!reachable) throw new Error("unreachable"); return true; });
    const { states } = mount(refresh);
    setOnline(false);
    act(() => { window.dispatchEvent(new Event("offline")); });
    expect(states.at(-1)?.offline).toBe(true);
    reachable = true;
    setOnline(true);
    act(() => { window.dispatchEvent(new Event("online")); });
    expect(states.at(-1)?.offline).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(refresh).toHaveBeenCalledWith("online");
    expect(states.at(-1)?.offline).toBe(false);
    expect(states.at(-1)?.syncedAt).not.toBeNull();
  });

  it("one failed re-read after a single change does not call the board offline", async () => {
    const refresh = vi.fn(async () => { throw new Error("blip"); });
    const { states } = mount(refresh);
    act(() => realtime.status?.("SUBSCRIBED"));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(refresh).toHaveBeenCalledWith("change");
    expect(states.some((state) => state.offline)).toBe(false);
  });

  it("bands how long the board was offline, content-free", () => {
    expect(offlineDurationBand(5_000)).toBe("under_30s");
    expect(offlineDurationBand(60_000)).toBe("30s_to_5m");
    expect(offlineDurationBand(600_000)).toBe("over_5m");
  });
});

describe("LIVE-2 the banner", () => {
  it("says the board is offline, as of when, and that editing is paused", () => {
    render(<BoardOfflineBanner offline syncedAt={new Date(2026, 10, 8, 12, 4).getTime()} />);
    expect(screen.getByTestId("board-offline-banner").textContent).toMatch(/^You're offline\. This is the board as of 12:04.*\. Editing is paused until you're back\.$/);
    expect(BOARD_OFFLINE_COPY.offline("12:04")).not.toMatch(/—/);
  });
  it("renders nothing when online", () => {
    const { container } = render(<BoardOfflineBanner offline={false} syncedAt={null} />);
    expect(container.textContent).toBe("");
  });
});

describe("LIVE-2 wiring", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const lab = readFileSync("src/hooks/use-canvas-lab.ts", "utf8");
  it("every edit gate goes through one flag that is false while offline", () => {
    expect(page).toMatch(/const boardEditable = Boolean\(lab\.board\?\.canEditStructure\) && !offline;/);
    const raw = page.split("\n").filter((line) => line.includes("lab.board?.canEditStructure"));
    expect(raw.every((line) => line.includes("const boardEditable") || line.includes("!== false && !offline"))).toBe(true);
    expect(page).not.toMatch(/editable=\{Boolean\(node\.local\)\}/);
  });
  it("the banner sits with the other board banners", () => {
    expect(page).toMatch(/<BoardOfflineBanner offline=\{offline\} syncedAt=\{boardConnection\.syncedAt\} \/>/);
  });
  it("a save with no connection fails at once", () => {
    expect(lab).toMatch(/navigator\.onLine === false\) \{\s*const offline = \{ status: "network_error"/);
  });
});
