// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AskLiveMark } from "@/components/canvas-lab/ask-draft/AskLiveMark";
import { LIFT_MS, useAskLift } from "@/components/canvas-lab/ask-draft/AskReadingLoops";
import {
  anchorStart,
  anchoredDelayMs,
  askMarkState,
  beginTurn,
  isOffStage,
  loopPath,
  offStageLine,
  phaseAt,
  READING_CYCLE_MS,
  resetReadingClock,
  takeLift,
  turnKeyFor,
} from "@/lib/ask-reading-clock";

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", { value: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) });
  }
  if (!(globalThis as { CSS?: unknown }).CSS) (globalThis as { CSS?: unknown }).CSS = { escape: (s: string) => s };
});
beforeEach(() => resetReadingClock());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("V2-3 rule 2: a redraw resumes, never restarts", () => {
  it("the first sighting fixes a turn's start; later calls return it", () => {
    expect(anchorStart("ask:q", 1_000)).toBe(1_000);
    expect(anchorStart("ask:q", 5_000)).toBe(1_000);
  });
  it("a remount mid-loop keeps its phase", () => {
    const key = turnKeyFor("What did we decide?");
    expect(phaseAt(key, 10_000)).toBe(0);
    // Mounted at 10s; the board redraws and the loops remount at 10.65s.
    const afterRemount = phaseAt(key, 10_650);
    expect(afterRemount).toBeCloseTo(650 / READING_CYCLE_MS, 6);
    // A fresh clock would have said 0. The anchored one carries on.
    expect(afterRemount).not.toBe(0);
  });
  it("the mark's CSS light is placed by a negative delay from the same anchor", () => {
    const key = turnKeyFor("q");
    anchorStart(key, 2_000);
    expect(anchoredDelayMs(key, 2_000 + READING_CYCLE_MS + 400)).toBe(-400);
  });
  it("remounting the mark mid-turn keeps the light where it was", () => {
    const key = turnKeyFor("q");
    const spy = vi.spyOn(performance, "now").mockReturnValue(1_000);
    beginTurn(key, 1_000);
    render(<AskLiveMark pending error={false} turnKey={key} />);
    cleanup();
    spy.mockReturnValue(1_900);
    const { getByTestId } = render(<AskLiveMark pending error={false} turnKey={key} />);
    expect((getByTestId("ask-live-light") as unknown as SVGPathElement).style.animationDelay).toBe("-900ms");
    spy.mockRestore();
  });
  it("a real new send with the same question starts its own clock and lifts", () => {
    const key = turnKeyFor("same question");
    anchorStart(key, 1_000);
    takeLift(key, "n1");
    beginTurn(key, 50_000);
    expect(phaseAt(key, 50_000)).toBe(0);
    expect(takeLift(key, "n1")).toBe(true);
  });
});

describe("V2-3 lift on done", () => {
  it("runs once per card per turn", () => {
    expect(takeLift("t", "a")).toBe(true);
    expect(takeLift("t", "a")).toBe(false);
    expect(takeLift("t", "b")).toBe(true);
  });
  it("lifts each read card once when the turn finishes, then clears; an error lifts nothing", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    host.innerHTML = `<div data-node-id="n1"></div><div data-node-id="n2"></div><button data-node-id="n1" data-side="top"></button>`;
    document.body.appendChild(host);
    const props = { host, nodeIds: ["n1", "n2"], error: false, turnKey: "ask:x" };
    const { rerender } = renderHook((p: { pending: boolean }) => useAskLift({ ...props, ...p }), { initialProps: { pending: true } });
    rerender({ pending: false });
    const cards = host.querySelectorAll("[data-node-id]:not([data-side])");
    expect([...cards].map((c) => c.getAttribute("data-ask-lift"))).toEqual(["on", "on"]);
    expect(host.querySelector("[data-side]")?.getAttribute("data-ask-lift")).toBeNull();
    act(() => { vi.advanceTimersByTime(LIFT_MS); });
    expect([...cards].map((c) => c.getAttribute("data-ask-lift"))).toEqual([null, null]);
    // A re-render after done does not lift again.
    rerender({ pending: true });
    rerender({ pending: false });
    expect([...cards].map((c) => c.getAttribute("data-ask-lift"))).toEqual([null, null]);

    const errHost = document.createElement("div");
    errHost.innerHTML = `<div data-node-id="e1"></div>`;
    const r2 = renderHook((p: { pending: boolean }) => useAskLift({ host: errHost, nodeIds: ["e1"], error: true, turnKey: "ask:err", ...p }), { initialProps: { pending: true } });
    r2.rerender({ pending: false });
    expect(errHost.querySelector("[data-node-id]")?.getAttribute("data-ask-lift")).toBeNull();
    host.remove();
  });
  it("decoration only: never sets data-editing, so it can never hold the board's redraw", () => {
    const src = readFileSync("src/components/canvas-lab/ask-draft/AskReadingLoops.tsx", "utf8") + readFileSync("src/components/canvas-lab/ask-draft/AskLiveMark.tsx", "utf8") + readFileSync("src/lib/ask-reading-clock.ts", "utf8");
    const code = src.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
    expect(code).not.toMatch(/data-editing|liveBusy|setState\(/);
  });
});

describe("V2-3 L2 light down the rope", () => {
  it("lime light only while working and online; ink after a failed or offline send", () => {
    expect(askMarkState({ pending: true, error: false, online: true })).toBe("live");
    expect(askMarkState({ pending: true, error: false, online: false })).toBe("ink");
    expect(askMarkState({ pending: false, error: true, online: true })).toBe("ink");
    expect(askMarkState({ pending: false, error: false, online: true })).toBe("idle");
  });
  it("renders the light only when live, and the mark goes ink on error", () => {
    const { getByTestId, queryByTestId, rerender } = render(<AskLiveMark pending error={false} turnKey="ask:a" />);
    expect(getByTestId("ask-live-mark").getAttribute("data-state")).toBe("live");
    expect(queryByTestId("ask-live-light")).toBeTruthy();
    rerender(<AskLiveMark pending={false} error turnKey="ask:a" />);
    expect(getByTestId("ask-live-mark").getAttribute("data-state")).toBe("ink");
    expect(queryByTestId("ask-live-light")).toBeNull();
  });
  it("the light is lime (--ask-live), never acid", () => {
    const src = readFileSync("src/components/canvas-lab/ask-draft/AskLiveMark.tsx", "utf8");
    expect(src).toMatch(/stroke: var\(--ask-live\)/);
    expect(src).not.toMatch(/acid|--halo-1/);
  });
});

describe("V2-3 board loops", () => {
  it("draws a closed loop that overshoots where it closes", () => {
    const d = loopPath({ left: 100, top: 100, right: 300, bottom: 200 });
    expect(d.startsWith("M")).toBe(true);
    expect(d).toMatch(/L\d/);
  });
  it("counts off-screen cards instead of drawing them", () => {
    const stage = { left: 0, top: 0, right: 800, bottom: 600 };
    expect(isOffStage({ left: 900, top: 10, right: 1100, bottom: 100 }, stage)).toBe(true);
    expect(isOffStage({ left: 700, top: 10, right: 900, bottom: 100 }, stage)).toBe(false);
    expect(offStageLine(0)).toBeNull();
    expect(offStageLine(3)).toBe("3 more off screen");
  });
});

describe("V2-3 flag off is today's board", () => {
  it("the Ask surface reaches the V2 mark, loops and lift only through ask-v2", () => {
    const src = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
    expect(src).toMatch(/askV2 \? <AskLiveMark[^]*: <LassoLoopMark/);
    expect(src).toMatch(/askV2\s*\?\s*<AskReadingLoops[^]*: <AskReadingLines/);
    expect(src).toMatch(/useAskLift\(\{ host: askV2 \? host : null/);
  });
});
