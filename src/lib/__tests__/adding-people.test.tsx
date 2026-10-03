import { describe, expect, it } from "vitest";

import { ADDING_PEOPLE, ADDING_PEOPLE_SECTIONS } from "@/lib/adding-people";

function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(allStrings);
  return [];
}

describe("adding people content", () => {
  it("keeps the six section ids in order", () => {
    expect(ADDING_PEOPLE_SECTIONS).toEqual(["start", "segments", "how_to", "visibility", "trouble", "faq"]);
  });

  it("uses only declared section ids", () => {
    for (const section of ADDING_PEOPLE.sections) {
      expect(ADDING_PEOPLE_SECTIONS).toContain(section.id);
    }
  });

  it("contains the four segment rows", () => {
    const segmentRows = ADDING_PEOPLE.sections.find((section) => section.id === "segments")?.table?.rows;
    expect(segmentRows).toEqual([
      ["Individuals you sponsor, a workshop, a fellowship, coaching clients", "Individual seats", "Their own private workspace", "You, by naming them or handing out a link"],
      ["A class or a student cohort", "School seats", "Their own student workspace, which they keep after the term", "You, the same two ways"],
      ["One client company or one team", "A team workspace", "Shared membership of one workspace", "The client's own admin, after you name that admin"],
      ["Your own practice", "A partner workspace", "Your staff share one workspace", "We set it up once, then you"],
    ]);
  });

  it("contains no em dash", () => {
    expect(allStrings(ADDING_PEOPLE).filter((value) => value.includes("—"))).toEqual([]);
  });
});
