import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { handoffLineFits, stripMentions } from "@/lib/ask-handoff";

const names = ["Research-->Presentation", "Q3 plan", "Kickoff call", "Plan"];

describe("H7c the line ignores words inside @ card names", () => {
  it("the case seen live: a card named Research no longer triggers it", () => {
    expect(handoffLineFits("What does @Research-->Presentation say about cheese?", names)).toBe(
      false,
    );
  });
  it("a name with spaces comes out whole, longest first", () => {
    expect(stripMentions("Summarise @Q3 plan for Ben", names)).not.toMatch(/plan/i);
    expect(handoffLineFits("Who joined @Kickoff call?", names)).toBe(false);
  });
  it("an @word that is not a known name is dropped too", () => {
    expect(handoffLineFits("What is in @strategy-notes?", [])).toBe(false);
  });
  it("the person's own words still count, with or without a mention", () => {
    expect(handoffLineFits("Draft an email from @Research-->Presentation", names)).toBe(true);
    expect(handoffLineFits("Plan next week using @Kickoff call", names)).toBe(true);
    expect(handoffLineFits("What are the next steps?")).toBe(true);
    expect(handoffLineFits("What did we decide on pricing?")).toBe(false);
  });
  it("names with regex characters are matched literally", () => {
    expect(stripMentions("see @a+b (v2).md now", ["a+b (v2).md"])).toBe("see   now");
  });
});

describe("H7c wiring", () => {
  it("the surface passes the board's card names and titles", () => {
    const src = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
    expect(src).toMatch(/flatMap\(\(item\) => \[displayName\(item\), item\.title\]\)/);
    expect(src).toMatch(/handoffLineFits\(lastQuestion, mentionNames\)/);
  });
});
