// @vitest-environment jsdom

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
      getPropertyValue: (name: string) => (name === "--nb-lasso-green" ? "token-green" : ""),
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

  it.each(["orbit", "loop", "gather", "trace", "signature"] as const)("draws %s from the token and cancels on unmount", (kind) => {
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
});