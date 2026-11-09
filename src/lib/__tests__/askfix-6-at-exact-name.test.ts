import { describe, expect, it } from "vitest";

import { pointedAtIds } from "@/lib/reflect-scope-shape";

const items = [
  { id: "short", title: "Kickoff", display_title: null },
  { id: "long", title: "Kickoff call", display_title: null },
  { id: "deck", title: "Copy_of_deck_v3.pptx", display_title: "Pilot deck" },
  { id: "deck2", title: "Pilot deck notes", display_title: null },
];

describe("ASK-FIX-6 @ picks the exact name", () => {
  it("@Kickoff points at Kickoff only, never Kickoff call", () => {
    expect(pointedAtIds("What came out of @Kickoff?", items)).toEqual(["short"]);
  });
  it("@Kickoff call points at Kickoff call only, not also Kickoff", () => {
    expect(pointedAtIds("What came out of @Kickoff call?", items)).toEqual(["long"]);
  });
  it("a renamed card's name and a longer title that starts with it stay apart", () => {
    expect(pointedAtIds("Compare @Pilot deck with @Pilot deck notes", items)).toEqual([
      "deck",
      "deck2",
    ]);
  });
  it("a name must end at a word boundary", () => {
    expect(pointedAtIds("@Kickoffs were great", items)).toEqual([]);
    expect(pointedAtIds("@kickoff, then @kickoff call.", items)).toEqual(["short", "long"]);
  });
  it("two pieces with the same name are both pointed at", () => {
    const twins = [...items, { id: "twin", title: "Kickoff", display_title: null }];
    expect(pointedAtIds("@Kickoff", twins)).toEqual(["short", "twin"]);
  });
  it("ASK-FIX-4 still holds: card name or original title, case-insensitive", () => {
    expect(pointedAtIds("@pilot deck", items)).toEqual(["deck"]);
    expect(pointedAtIds("@Copy_of_deck_v3.pptx", items)).toEqual(["deck"]);
    expect(pointedAtIds("no mention", items)).toEqual([]);
  });
});
