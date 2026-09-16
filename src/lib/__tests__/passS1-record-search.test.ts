import { describe, expect, it } from "vitest";

import {
  allWordsPresent,
  canonicalizeNumber,
  contentHasNumber,
  queryWords,
  rankThreadHits,
  surfaceFormsFor,
  trigramSimilarity,
} from "@/lib/find-it.functions";

describe("pass S1 · one written form for a number", () => {
  it("lands every surface form on the same canonical number", () => {
    expect(canonicalizeNumber("$4,200")).toBe("4200");
    expect(canonicalizeNumber("4200")).toBe("4200");
    expect(canonicalizeNumber("4.2k")).toBe("4200");
    expect(canonicalizeNumber("4.2K")).toBe("4200");
    expect(canonicalizeNumber("£4 200")).toBe("4200");
  });

  it("keeps thousands and millions apart", () => {
    expect(canonicalizeNumber("4.2M")).toBe("4200000");
    expect(canonicalizeNumber("4.2M")).not.toBe(canonicalizeNumber("4.2k"));
  });

  it("turns down words", () => {
    expect(canonicalizeNumber("four thousand")).toBeNull();
  });

  it("asks the record for the forms a person would have written", () => {
    expect(surfaceFormsFor("4200")).toEqual(expect.arrayContaining(["4200", "4,200", "4.2k"]));
  });

  it("only confirms a number that is really in the text", () => {
    expect(contentHasNumber("We landed at $4,200 for the pilot.", "4200")).toBe(true);
    expect(contentHasNumber("We landed at 4.2k for the pilot.", "4200")).toBe(true);
    expect(contentHasNumber("We landed at 4.2M for the pilot.", "4200")).toBe(false);
    expect(contentHasNumber("No figures were agreed.", "4200")).toBe(false);
  });
});

describe("pass S1 · forgiving thread search", () => {
  it("takes every word in any order", () => {
    const words = queryWords("pricing ladder discount");
    expect(allWordsPresent("The discount on the pricing ladder held.", words)).toBe(true);
    expect(allWordsPresent("The pricing ladder held.", words)).toBe(false);
  });

  it("sees past a typo", () => {
    expect(trigramSimilarity("discount ladder", "discunt ladder")).toBeGreaterThan(0.3);
    expect(trigramSimilarity("discount ladder", "quarterly headcount")).toBeLessThan(0.3);
  });

  it("ranks exact above all words above similar", () => {
    const ranked = rankThreadHits([
      { id: "c", tier: "similar" as const },
      { id: "b", tier: "words" as const },
      { id: "a", tier: "exact" as const },
    ]);
    expect(ranked.map((hit) => hit.id)).toEqual(["a", "b", "c"]);
  });
});

describe("pass S1 · plain words on the results list", () => {
  it("labels the looser tiers and never shows a figure for closeness", () => {
    const page = new URL("../../pages/FindItPage.tsx", import.meta.url);
    const source = require("node:fs").readFileSync(page, "utf8") as string;
    expect(source).toContain("closest matches");
    expect(source).not.toMatch(/confidence|match %/i);
  });
});
