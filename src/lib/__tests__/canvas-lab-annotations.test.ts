import { describe, expect, it } from "vitest";

import {
  annotationTextHash,
  excerptFor,
  isStaleHighlight,
  lengthBand,
  mergeRanges,
  normalizeAnnotationText,
  validateHighlightRange,
  MAX_EXCERPT_LENGTH,
} from "../canvas-lab-annotations-shared";

describe("highlight ranges", () => {
  const content = "The pricing floor is 40 percent.";

  it("accepts a real forward span inside the turn", () => {
    expect(validateHighlightRange(content, 4, 17)).toBeNull();
  });

  it("refuses an empty or backwards span", () => {
    expect(validateHighlightRange(content, 9, 9)).toBe("Select some text first.");
    expect(validateHighlightRange(content, 12, 4)).toBe("Select some text first.");
  });

  it("refuses a span past the end of the turn", () => {
    expect(validateHighlightRange(content, 4, content.length + 5)).toBe(
      "That selection is outside this turn.",
    );
  });

  it("refuses a span that is only whitespace", () => {
    expect(validateHighlightRange("a   b", 1, 4)).toBe("Select some text first.");
  });

  it("caps the excerpt at the stored length", () => {
    const long = "x".repeat(900);
    expect(excerptFor(long, 0, 900)).toHaveLength(MAX_EXCERPT_LENGTH);
  });
});

describe("the excerpt hash", () => {
  it("ignores whitespace runs and case", async () => {
    expect(normalizeAnnotationText("  The   Pricing\nFloor ")).toBe("the pricing floor");
    expect(await annotationTextHash("  The   Pricing\nFloor ")).toBe(
      await annotationTextHash("the pricing floor"),
    );
  });

  it("still separates different words", async () => {
    expect(await annotationTextHash("floor")).not.toBe(await annotationTextHash("ceiling"));
  });
});

describe("merging and staleness", () => {
  it("merges overlapping and touching ranges", () => {
    expect(
      mergeRanges([
        { charStart: 10, charEnd: 20 },
        { charStart: 0, charEnd: 5 },
        { charStart: 15, charEnd: 30 },
        { charStart: 5, charEnd: 8 },
      ]),
    ).toEqual([
      { charStart: 0, charEnd: 8 },
      { charStart: 10, charEnd: 30 },
    ]);
  });

  it("calls a highlight stale only when the turn hash moved", () => {
    expect(isStaleHighlight("aaa", "aaa")).toBe(false);
    expect(isStaleHighlight("aaa", "bbb")).toBe(true);
    expect(isStaleHighlight(null, "bbb")).toBe(false);
  });
});

describe("the length band", () => {
  it("bands instead of reporting a count", () => {
    expect(lengthBand(0)).toBe("le50");
    expect(lengthBand(50)).toBe("le50");
    expect(lengthBand(51)).toBe("le200");
    expect(lengthBand(200)).toBe("le200");
    expect(lengthBand(201)).toBe("le500");
    expect(lengthBand(500)).toBe("le500");
    expect(lengthBand(501)).toBe("gt500");
    expect(lengthBand(5000)).toBe("gt500");
  });
});
