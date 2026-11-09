import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { pointedAtIds } from "@/lib/reflect-scope-shape";

const items = [
  { id: "a", title: "Copy_of_Evolocity_AI-Artemis_deck_v3.pptx", display_title: "Pilot deck" },
  { id: "b", title: "Kickoff call", display_title: null },
  { id: "c", title: "evolocity-pilot-toolkit-workplan.md", display_title: "  " },
];

describe("ASK-FIX-4 @ points by the name on the card", () => {
  it("a renamed piece is found by its card name", () => {
    expect(pointedAtIds("What does @Pilot deck say about week one?", items)).toEqual(["a"]);
  });
  it("its original title still works, so nothing that worked before breaks", () => {
    expect(pointedAtIds("@Copy_of_Evolocity_AI-Artemis_deck_v3.pptx summary", items)).toEqual([
      "a",
    ]);
  });
  it("pieces never renamed, or renamed to blank, match their title", () => {
    expect(pointedAtIds("@kickoff call and @evolocity-pilot-toolkit-workplan.md", items)).toEqual([
      "b",
      "c",
    ]);
  });
  it("no @, no pointing; an unknown name points at nothing", () => {
    expect(pointedAtIds("Pilot deck", items)).toEqual([]);
    expect(pointedAtIds("@Nothing by this name", items)).toEqual([]);
  });
});

describe("ASK-FIX-4 the @ list and what it inserts", () => {
  const hook = readFileSync("src/components/reflect/use-ask-lasso.ts", "utf8");
  it("the list matches on the card name or the original title", () => {
    expect(hook).toMatch(/\.filter\(\(item\) => nameMatches\(item, mention\.query\)\)/);
  });
  it("picking inserts the card name, which pointedAtIds then finds", () => {
    expect(hook).toMatch(/@\$\{displayName\(item\)\} \$\{draft\.slice\(caret\)\}/);
    expect(hook).not.toMatch(/@\$\{item\.title\}/);
  });
});
