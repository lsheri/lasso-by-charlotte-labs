// @vitest-environment jsdom

import type React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";

const context = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  setTransform: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  stroke: vi.fn(),
  fillStyle: "",
  globalAlpha: 1,
  lineCap: "butt",
  lineJoin: "miter",
  lineWidth: 1,
  strokeStyle: "",
};

describe("LassoThinkingMark", () => {
  beforeEach(() => {
    for (const value of Object.values(context)) {
      if (typeof value === "function" && "mockClear" in value) value.mockClear();
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) => ({ "--nb-lasso-green": "token-green", "--nb-ink": "token-ink", "--nb-graphite": "token-graphite" } as Record<string, string>)[name] ?? "",
    } as CSSStyleDeclaration);
    vi.stubGlobal("devicePixelRatio", 3);
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 17));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => vi.restoreAllMocks());

  it.each(["orbit", "loop", "gather", "trace"] as const)("draws %s from the token and cancels on unmount", (kind) => {
    const { unmount } = render(
      <LassoThinkingMark kind={kind} size={72} {...(kind === "gather" ? { count: 3 } : {})} />,
    );
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(context.fillStyle).toBe("token-green");
    expect(context.strokeStyle).toBe("token-green");
    expect(requestAnimationFrame).toHaveBeenCalled();
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
  });

  it("draws once and schedules no frame under reduced motion", () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    render(<LassoThinkingMark kind="loop" size={24} />);
    expect(context.clearRect).toHaveBeenCalled();
    expect(context.stroke).toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("keeps the dimensional loop visible before any verified source arrives", () => {
    vi.spyOn(performance, "now").mockReturnValue(1_000);
    let nextFrame: FrameRequestCallback | undefined;
    vi.mocked(requestAnimationFrame).mockImplementation((callback) => {
      nextFrame = callback;
      return 17;
    });
    render(<LassoThinkingMark kind="gather" size={56} count={0} />);
    const firstCount = context.arc.mock.calls.length;
    act(() => nextFrame?.(2_000));
    expect(firstCount).toBeGreaterThanOrEqual(48);
    expect(context.arc.mock.calls.length).toBeGreaterThan(firstCount);
    expect(context.globalAlpha).toBe(1);
  });

  it("keeps gather arrival times comparable when count changes", () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(6_000);
    const { rerender } = render(<LassoThinkingMark kind="gather" size={56} count={1} />);
    context.arc.mockClear();
    rerender(<LassoThinkingMark kind="gather" size={56} count={2} />);
    const radii = context.arc.mock.calls.map((call) => Number(call[2]));
    expect(radii.some((radius) => radius > 0)).toBe(true);
    expect(radii.some((radius) => radius === 0)).toBe(true);
  });

  it("stops scheduling while outside the viewport", () => {
    let observerCallback: IntersectionObserverCallback | undefined;
    class TestObserver {
      constructor(callback: IntersectionObserverCallback) { observerCallback = callback; }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", TestObserver);
    render(<LassoThinkingMark kind="orbit" size={72} />);
    expect(context.clearRect).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    act(() => observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(requestAnimationFrame).toHaveBeenCalled();
    act(() => observerCallback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  describe("TM-1 signature engine", () => {
    function runFrames(element: React.ReactElement, frames: number[]) {
      const callbacks: FrameRequestCallback[] = [];
      vi.mocked(requestAnimationFrame).mockImplementation((callback) => { callbacks.push(callback); return 17; });
      vi.spyOn(performance, "now").mockReturnValue(0);
      const strokes: string[] = [];
      const fills: string[] = [];
      context.stroke.mockImplementation(() => { strokes.push(context.strokeStyle); });
      context.fill.mockImplementation(() => { fills.push(context.fillStyle); });
      const view = render(element);
      for (const at of frames) act(() => callbacks[callbacks.length - 1]?.(at));
      return { view, colours: [...strokes, ...fills] };
    }

    it("draws once, dpr capped at 3, and schedules no frame under reduced motion", () => {
      vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as unknown as MediaQueryList);
      render(<LassoThinkingMark kind="signature" size={72} />);
      expect(context.setTransform).toHaveBeenCalledWith(3, 0, 0, 3, 0, 0);
      expect(context.stroke).toHaveBeenCalled();
      expect(requestAnimationFrame).not.toHaveBeenCalled();
      expect(context.strokeStyle).toBe("token-graphite");
    });

    it.each([[120, 56], [72, 40], [28, 22], [16, 12]])("draws %ipx with %i pieces", (size, pieces) => {
      context.arc.mockClear(); context.moveTo.mockClear();
      runFrames(<LassoThinkingMark kind="signature" size={size} />, [16]);
      // answered at t=0.016 sits early in the loop: every piece is drawn once, as a dot or a dash, plus the loop stroke start.
      const marks = context.arc.mock.calls.length + context.moveTo.mock.calls.length;
      expect(marks).toBeGreaterThanOrEqual(pieces);
      expect(marks).toBeLessThanOrEqual(pieces + 2);
    });

    it("answered uses graphite only; thinking adds lime from the token", () => {
      const answered = runFrames(<LassoThinkingMark kind="signature" size={72} />, [500, 1500, 3000, 4500]);
      expect(answered.colours.length).toBeGreaterThan(0);
      expect(new Set(answered.colours)).toEqual(new Set(["token-graphite"]));
      answered.view.unmount();
      const thinking = runFrames(<LassoThinkingMark kind="signature" size={72} thinking />, [500, 1500, 3000, 3900]);
      expect(thinking.colours).toContain("token-green");
      expect(thinking.colours).toContain("token-ink");
      expect(thinking.colours).not.toContain("token-graphite");
    });

    it("rope=false draws only the finished loop under reduced motion", () => {
      vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as unknown as MediaQueryList);
      const { rerender, unmount } = render(<LassoThinkingMark kind="signature" size={28} thinking rope={false} />);
      expect(context.stroke).toHaveBeenCalledTimes(1);
      expect(context.moveTo).toHaveBeenCalledTimes(1);
      expect(requestAnimationFrame).not.toHaveBeenCalled();
      context.stroke.mockClear();
      context.moveTo.mockClear();
      rerender(<LassoThinkingMark kind="signature" size={28} thinking />);
      expect(context.stroke).toHaveBeenCalledTimes(2);
      expect(context.moveTo).toHaveBeenCalledTimes(2);
      unmount();
    });

    it("rope=false never draws the rope across a complete thinking cycle", () => {
      vi.stubGlobal("IntersectionObserver", undefined);
      let segments = 0;
      const paths: number[] = [];
      context.beginPath.mockImplementation(() => { segments = 0; });
      context.lineTo.mockImplementation(() => { segments += 1; });
      context.stroke.mockImplementation(() => { paths.push(segments); });
      const callbacks: FrameRequestCallback[] = [];
      vi.mocked(requestAnimationFrame).mockImplementation((callback) => { callbacks.push(callback); return 17; });
      vi.spyOn(performance, "now").mockReturnValue(0);
      const { rerender, unmount } = render(<LassoThinkingMark kind="signature" size={28} thinking rope={false} />);
      for (let at = 16; at <= 12_000; at += 16) act(() => callbacks.at(-1)?.(at));
      const withLoop = paths.filter((count) => count > 1);
      expect(withLoop.length).toBeGreaterThan(0);
      const noRope = paths.length;
      paths.length = 0;
      callbacks.length = 0;
      rerender(<LassoThinkingMark kind="signature" size={28} thinking />);
      for (let at = 16; at <= 12_000; at += 16) act(() => callbacks.at(-1)?.(at));
      expect(paths.length).toBeGreaterThan(noRope);
      expect(paths.filter((count) => count > 1)).toEqual(withLoop);
      unmount();
    });

    it("keeps the frame loop but draws nothing off screen, and cancels on unmount", () => {
      let observerCallback: IntersectionObserverCallback | undefined;
      class TestObserver {
        constructor(callback: IntersectionObserverCallback) { observerCallback = callback; }
        observe() {}
        disconnect() {}
      }
      vi.stubGlobal("IntersectionObserver", TestObserver);
      const callbacks: FrameRequestCallback[] = [];
      vi.mocked(requestAnimationFrame).mockImplementation((callback) => { callbacks.push(callback); return 17; });
      const { unmount } = render(<LassoThinkingMark kind="signature" size={72} />);
      act(() => observerCallback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
      context.clearRect.mockClear();
      act(() => callbacks[callbacks.length - 1]?.(performance.now() + 16));
      expect(context.clearRect).not.toHaveBeenCalled();
      unmount();
      expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
    });
  });
});
