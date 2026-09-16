import { describe, expect, it } from "vitest";

import {
  allWordsPresent,
  bestWordSimilarity,
  queryWords,
  rankThreadHits,
  trigramProbes,
} from "@/lib/find-it.functions";

const TURN = "We revisited the assumption behind the tiered pricing before the board call.";

describe("closest matches survive a typo", () => {
  it("builds start, middle and end probes for long words", () => {
    const probes = trigramProbes("assumtion behind");
    expect(probes).toContain("assu");
    expect(probes).toContain("tion");
    expect(probes.every((probe) => probe.length === 4)).toBe(true);
  });

  it("a probe from the typo still appears in the correctly spelled turn", () => {
    const probes = trigramProbes("assumtion");
    expect(probes.some((probe) => TURN.toLowerCase().includes(probe))).toBe(true);
  });

  it("scores the misspelled word close enough to reach the similar tier", () => {
    expect(bestWordSimilarity(TURN, "assumtion")).toBeGreaterThanOrEqual(0.3);
    expect(bestWordSimilarity(TURN, "invoice")).toBeLessThan(0.3);
  });

  it("leaves exact and all words behaviour alone", () => {
    expect(queryWords("tiered pricing")).toEqual(["tiered", "pricing"]);
    expect(allWordsPresent(TURN, ["tiered", "pricing"])).toBe(true);
    expect(allWordsPresent(TURN, ["tiered", "invoice"])).toBe(false);
    expect(
      rankThreadHits([
        { id: "c", tier: "similar" as const },
        { id: "a", tier: "exact" as const },
        { id: "b", tier: "words" as const },
      ]).map((hit) => hit.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("short words give no probes, so the tier simply does not fire", () => {
    expect(trigramProbes("the cat")).toEqual([]);
  });
});
