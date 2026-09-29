// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  KEY_STORAGE,
  clearActivationKey,
  markActivationKey,
  readActivationKey,
} from "@/lib/key-entry";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("key-entry", () => {
  it("stores nothing for empty input", () => {
    markActivationKey("");
    markActivationKey("   ");
    markActivationKey(undefined);
    expect(window.localStorage.getItem(KEY_STORAGE)).toBeNull();
  });

  it("stores nothing for a 201 character input", () => {
    markActivationKey("a".repeat(201));
    expect(readActivationKey()).toBeNull();
  });

  it("stores a lowercase code uppercased and trimmed", () => {
    markActivationKey("  abc-123  ");
    expect(readActivationKey()).toBe("ABC-123");
  });

  it("clearActivationKey empties it", () => {
    markActivationKey("abc");
    clearActivationKey();
    expect(readActivationKey()).toBeNull();
  });

  it("a throwing storage never throws out", () => {
    const boom = () => {
      throw new Error("disabled");
    };
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);
    expect(() => markActivationKey("abc")).not.toThrow();
    expect(() => readActivationKey()).not.toThrow();
    expect(readActivationKey()).toBeNull();
    expect(() => clearActivationKey()).not.toThrow();
  });
});
