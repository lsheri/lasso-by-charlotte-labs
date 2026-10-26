import { describe, expect, it } from "vitest";
import { containingSection, markedSectionAt } from "@/lib/board-section";

// One fixture shared by every case, matching the confirmed section_members results.
const fixture = {
  sections: [
    { id: "outer", x: 0, y: 0, width: 1000, height: 1000, periodStart: "2026-10-26" },
    { id: "inner", x: 100, y: 100, width: 200, height: 200, sequenceNo: 0 },
    { id: "eqA", x: 500, y: 500, width: 300, height: 300, periodStart: "2026-10-26" },
    { id: "eqB", x: 520, y: 520, width: 300, height: 300, sequenceNo: 2 },
  ],
  cards: [
    { id: "plain", x: 400, y: 400, width: 40, height: 40, expected: "outer" },
    { id: "nested", x: 150, y: 150, width: 40, height: 40, expected: "inner" },
    { id: "equal", x: 600, y: 600, width: 40, height: 40, expected: "eqB" },
    { id: "edge", x: 960, y: 0, width: 40, height: 40, expected: "outer" },
    { id: "miss", x: 2000, y: 2000, width: 40, height: 40, expected: null },
  ],
};

function centre(card: { x: number; y: number; width: number; height: number }) {
  return { x: card.x + card.width / 2, y: card.y + card.height / 2 };
}

describe("SECD-D one section membership predicate", () => {
  it.each(fixture.cards)("containingSection assigns $id by its rect centre", (card) => {
    expect(containingSection(card, fixture.sections)?.id ?? null).toBe(card.expected);
  });

  it.each(fixture.cards)("markedSectionAt gives the same answer for $id when all sections are marked", (card) => {
    expect(markedSectionAt(fixture.sections, centre(card))).toBe(card.expected);
  });

  it.each(fixture.cards)("markedSectionAt skips unmarked sections for $id", (card) => {
    const sections = fixture.sections.map((section) => ({ ...section, periodStart: null, sequenceNo: null }));
    expect(markedSectionAt(sections, centre(card))).toBeNull();
  });

  it("returns the marked inner section rather than the outer section first in draw order", () => {
    const nested = fixture.cards.find((card) => card.id === "nested");
    if (!nested) throw new Error("Missing nested fixture card");
    expect(markedSectionAt(fixture.sections, centre(nested))).toBe("inner");
    expect(markedSectionAt([...fixture.sections].reverse(), centre(nested))).toBe("inner");
  });

  it("falls back to the marked outer section when the inner section is unmarked", () => {
    const nested = fixture.cards.find((card) => card.id === "nested");
    if (!nested) throw new Error("Missing nested fixture card");
    const sections = fixture.sections.map((section) => section.id === "inner"
      ? { ...section, periodStart: null, sequenceNo: null }
      : section);
    expect(markedSectionAt(sections, centre(nested))).toBe("outer");
  });
});