import { describe, expect, it } from "vitest";

import { TOUR_CONTENT } from "@/lib/tour-content";

const REGISTERS = ["company", "partner", "personal", "edu"] as const;
const FORBIDDEN = /\u2014|\baudit\b|\boversight\b|\bmonitor\b|\btrack\b|\bsurveillance\b|\bgovernance\b|\bscore\b/i;

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("T1 tour content", () => {
  it("defines five complete acts for every register", () => {
    expect(Object.keys(TOUR_CONTENT).sort()).toEqual([...REGISTERS].sort());
    for (const register of REGISTERS) {
      const acts = TOUR_CONTENT[register].acts;
      expect(acts).toHaveLength(5);
      expect(acts.map((act) => act.id)).toEqual([1, 2, 3, 4, 5]);
      const cards = acts[1]?.cards ?? [];
      expect(cards).toHaveLength(5);
      expect(cards.filter((card) => card.inSet)).toHaveLength(3);
    }
  });

  it("ties every answer claim to one selected card in the same register", () => {
    for (const register of REGISTERS) {
      const acts = TOUR_CONTENT[register].acts;
      const selected = new Set((acts[1]?.cards ?? []).filter((card) => card.inSet).map((card) => card.title));
      const answer = acts[3]?.answer ?? [];
      expect(answer).toHaveLength(3);
      for (const claim of answer) expect(selected.has(claim.sourceCardTitle)).toBe(true);
    }
  });

  it("keeps every content string within the language rules", () => {
    for (const value of strings(TOUR_CONTENT)) expect(value).not.toMatch(FORBIDDEN);
  });
});