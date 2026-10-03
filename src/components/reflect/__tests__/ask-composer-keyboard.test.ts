// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { hasTouchInput, shouldSendAskOnEnter } from "@/components/reflect/AskSurface";

function key(overrides: Partial<Parameters<typeof shouldSendAskOnEnter>[0]> = {}) {
  return {
    key: "Enter",
    shiftKey: false,
    isComposing: false,
    keyCode: 13,
    ...overrides,
  };
}

describe("Ask Lasso composer keyboard", () => {
  it("sends on Enter", () => {
    expect(shouldSendAskOnEnter(key(), false, "A question", false)).toBe(true);
  });

  it("does not send on Shift+Enter", () => {
    expect(shouldSendAskOnEnter(key({ shiftKey: true }), false, "A question", false)).toBe(false);
  });

  it("does not send while an input method is composing", () => {
    expect(shouldSendAskOnEnter(key({ isComposing: true }), false, "A question", false)).toBe(false);
    expect(shouldSendAskOnEnter(key({ keyCode: 229 }), false, "A question", false)).toBe(false);
  });

  it("does not send Enter on a touch device", () => {
    expect(shouldSendAskOnEnter(key(), true, "A question", false)).toBe(false);
  });

  it("does not treat touch points with a fine pointer as touch", () => {
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
    const matchMedia = vi.fn(() => ({ matches: false }));
    Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia });
    try {
      expect(hasTouchInput()).toBe(false);
    } finally {
      delete (navigator as { maxTouchPoints?: unknown }).maxTouchPoints;
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  it("does not send whitespace-only input", () => {
    expect(shouldSendAskOnEnter(key(), false, "   \n", false)).toBe(false);
  });
});