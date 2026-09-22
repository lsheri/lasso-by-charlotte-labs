import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";

const context = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  fill: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
  fillStyle: "",
  globalAlpha: 1,
  lineCap: "butt",
  lineWidth: 1,
  strokeStyle: "",
};

describe("LassoThinkingMark", () => {
  beforeEach(() => {
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

  it.each(["orbit", "loop", "gather", "trace"] as const)("draws %s from the token and cancels on unmount", (kind) => {
    const { unmount } = render(<LassoThinkingMark kind={kind} size={72} count={kind === "gather" ? 3 : undefined} />);
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(context.fillStyle === "token-green" || context.strokeStyle === "token-green").toBe(true);
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
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("draws the zero-source gather centre dot without error", () => {
    expect(() => render(<LassoThinkingMark kind="gather" size={72} count={0} />)).not.toThrow();
    expect(context.arc).toHaveBeenCalled();
    expect(context.globalAlpha).toBe(1);
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
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    act(() => observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(requestAnimationFrame).toHaveBeenCalled();
    act(() => observerCallback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});