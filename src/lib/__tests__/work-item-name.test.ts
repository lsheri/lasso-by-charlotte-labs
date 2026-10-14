import { describe, expect, it } from "vitest";

import { displayName, normalizeDisplayTitle } from "@/lib/work-item-name";

describe("displayName", () => {
  it("falls back to title when display_title is null, empty or whitespace", () => {
    expect(displayName({ display_title: null, title: "Orig" })).toBe("Orig");
    expect(displayName({ display_title: "", title: "Orig" })).toBe("Orig");
    expect(displayName({ display_title: "   ", title: "Orig" })).toBe("Orig");
    expect(displayName({ title: "Orig" })).toBe("Orig");
    expect(displayName({})).toBe("");
  });
  it("returns display_title when set", () => {
    expect(displayName({ display_title: "Shared name", title: "Orig" })).toBe("Shared name");
  });
});

describe("normalizeDisplayTitle", () => {
  it("returns null for empty, whitespace and the original title", () => {
    expect(normalizeDisplayTitle("", "Orig")).toBeNull();
    expect(normalizeDisplayTitle("   ", "Orig")).toBeNull();
    expect(normalizeDisplayTitle("  Orig ", "Orig")).toBeNull();
  });
  it("trims and returns the chosen name otherwise", () => {
    expect(normalizeDisplayTitle("  New name  ", "Orig")).toBe("New name");
  });
});
