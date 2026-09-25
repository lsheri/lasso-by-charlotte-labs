// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { recordAnonymousEventFn } = vi.hoisted(() => ({
  recordAnonymousEventFn: vi.fn(() => Promise.resolve({ ok: true })),
}));
vi.mock("@/lib/telemetry.functions", () => ({ recordAnonymousEventFn }));

import { chooseDemoNotePosition, DemoTourNote } from "@/components/demo/DemoTourNote";
import { DEMO_TOUR_DONE, useDemoTour } from "@/hooks/use-demo-tour";
import { guardEventDims } from "@/lib/event-dim-allowlist";
import { noteDemoStepCompleted, noteDemoTourSkipped, resetDemoTelemetry } from "@/lib/demo-telemetry";

const KEY = "lasso.demo.tour.step.v1";

beforeEach(() => {
  document.body.innerHTML = "";
  window.sessionStorage.clear();
  recordAnonymousEventFn.mockClear();
  resetDemoTelemetry();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: vi.fn(() => [document.body]),
  });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: vi.fn(() => []),
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 120, right: 220, top: 240, bottom: 280, width: 100, height: 40, x: 120, y: 240, toJSON: () => ({}) });
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("demo tour progress", () => {
  it("advances only when the expected real action completes", () => {
    const { result } = renderHook(() => useDemoTour());
    expect(result.current.step).toBe(1);
    act(() => result.current.complete(2, "YSM-01"));
    expect(result.current.step).toBe(1);
    act(() => result.current.complete(1, "home"));
    expect(result.current.step).toBe(2);
    expect(window.sessionStorage.getItem(KEY)).toBe("2");
  });

  it("skip hides the whole path, while Done completes step 7", () => {
    const first = renderHook(() => useDemoTour());
    act(() => first.result.current.dismiss());
    expect(first.result.current.step).toBe(DEMO_TOUR_DONE);
    first.unmount();
    window.sessionStorage.setItem(KEY, "7");
    const final = renderHook(() => useDemoTour());
    act(() => final.result.current.complete(7, "YSM-01"));
    expect(final.result.current.step).toBe(DEMO_TOUR_DONE);
  });

  it("still renders and advances in memory when session storage throws", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const { result } = renderHook(() => useDemoTour());
    expect(result.current.step).toBe(1);
    act(() => result.current.complete(1, "home"));
    expect(result.current.step).toBe(2);
    get.mockRestore();
    set.mockRestore();
  });

  it("skips a missing step without recording a completed action", () => {
    const { result } = renderHook(() => useDemoTour());
    act(() => result.current.skipMissing(1));
    expect(result.current.step).toBe(2);
    expect(recordAnonymousEventFn).not.toHaveBeenCalled();
  });
});

describe("demo margin note", () => {
  it("chooses the first clear side using elementsFromPoint", () => {
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 800);
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({ left: 450, right: 550, top: 300, bottom: 340, width: 100, height: 40, x: 450, y: 300, toJSON: () => ({}) });
    const blockingText = document.createElement("p");
    blockingText.textContent = "Occupied";
    document.body.appendChild(blockingText);
    const points = vi.mocked(document.elementsFromPoint).mockImplementation((x) => x > 550 ? [blockingText, document.body] : [document.body]);

    expect(chooseDemoNotePosition(anchor, 286)?.placement).toBe("left");
    expect(points).toHaveBeenCalled();
    anchor.remove();
    blockingText.remove();
  });

  it("samples a dense grid and rejects a side that crosses the preset bar", () => {
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 800);
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({ left: 450, right: 550, top: 300, bottom: 340, width: 100, height: 40, x: 450, y: 300, toJSON: () => ({}) });
    const bar = document.createElement("div");
    bar.setAttribute("data-demo-tour-collision-bar", "");
    document.body.appendChild(bar);
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({ left: 562, right: 848, top: 330, bottom: 380, width: 286, height: 50, x: 562, y: 330, toJSON: () => ({}) });
    vi.mocked(document.elementsFromPoint).mockImplementation((x, y) => x >= 590 && x <= 620 && y >= 300 && y <= 320 ? [bar, document.body] : [document.body]);

    expect(chooseDemoNotePosition(anchor, 286)?.placement).toBe("left");
    expect(vi.mocked(document.elementsFromPoint).mock.calls.length).toBeGreaterThan(9);
  });

  it("docks on phones and scrolls the anchor above the strip", () => {
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 844);
    const scrollIntoView = vi.fn();
    const anchor = document.createElement("button");
    anchor.setAttribute("data-testid", "phone-anchor");
    anchor.scrollIntoView = scrollIntoView;
    document.body.appendChild(anchor);
    render(<DemoTourNote step={2} anchorTestId="phone-anchor" onDismiss={() => undefined}>Ask the CFO's question.</DemoTourNote>);

    expect(screen.getByTestId("demo-tour-note-2").getAttribute("data-placement")).toBe("dock");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
    expect(document.documentElement.getAttribute("data-demo-tour-docked")).toBe("true");
  });

  it("places a wide anchor beside its shorter visible text", () => {
    vi.stubGlobal("innerWidth", 1372);
    vi.stubGlobal("innerHeight", 732);
    const anchor = document.createElement("button");
    anchor.textContent = "Read what went into this response 4";
    document.body.appendChild(anchor);
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({ left: 302, right: 1070, top: 635, bottom: 665, width: 768, height: 30, x: 302, y: 635, toJSON: () => ({}) });
    vi.mocked(Range.prototype.getClientRects).mockReturnValue([
      { left: 318, right: 580, top: 640, bottom: 660, width: 262, height: 20, x: 318, y: 640, toJSON: () => ({}) },
    ] as unknown as DOMRectList);

    const position = chooseDemoNotePosition(anchor, 286);

    expect(position).toMatchObject({ placement: "right", left: 592, width: 286, hits: 0 });
    anchor.remove();
  });

  it("anchors one reduced-motion note and dismisses it", () => {
    const dismiss = vi.fn();
    render(<><button data-testid="anchor">Anchor</button><DemoTourNote step={1} anchorTestId="anchor" onDismiss={dismiss}>Start here: the CFO asked where a number came from.</DemoTourNote></>);
    const note = screen.getByTestId("demo-tour-note-1");
    expect(note.getAttribute("data-reduced-motion")).toBe("true");
    expect(screen.getByTestId("anchor").getAttribute("data-demo-tour-anchor")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Skip the tour" }));
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("renders nothing when its anchor is absent", () => {
    render(<DemoTourNote step={2} anchorTestId="missing" onDismiss={() => undefined}>Ask the CFO's question.</DemoTourNote>);
    expect(screen.queryByTestId("demo-tour-note-2")).toBeNull();
  });

  it("labels the final dismissal Done", () => {
    render(<><button data-testid="pilot">Pilot</button><DemoTourNote step={7} anchorTestId="pilot" onDismiss={() => undefined} final>Want this on your team's work? Book a pilot.</DemoTourNote></>);
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
  });
});

describe("demo tour events", () => {
  it("allowlists only the approved dimensions", () => {
    expect(guardEventDims("demo.step_completed", { step: 3, engagement: "ysm-01", extra: "x" }).dims).toEqual({ step: 3, engagement: "ysm-01" });
    expect(guardEventDims("demo.tour_skipped", { step: 4, engagement: "ysm-01" }).dims).toEqual({ step: 4 });
  });

  it("uses the existing duplicate guard", () => {
    noteDemoStepCompleted(1, "home");
    noteDemoStepCompleted(1, "home");
    noteDemoTourSkipped(2);
    noteDemoTourSkipped(2);
    expect(recordAnonymousEventFn).toHaveBeenCalledTimes(2);
  });
});