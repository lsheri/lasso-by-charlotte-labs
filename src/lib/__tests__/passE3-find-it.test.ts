import { describe, expect, it } from "vitest";

import { orderByQuote } from "@/lib/find-it.functions";
import {
  MIN_SHARED_SENTENCE_CHARS,
  MIN_SHARED_SENTENCE_WORDS,
  qualifiesAsSharedSentence,
  sentencesOf,
} from "@/lib/lineage.server";

describe("pass E3 · the honesty gate on a shared sentence", () => {
  it("pins the floor", () => {
    expect(MIN_SHARED_SENTENCE_CHARS).toBe(40);
    expect(MIN_SHARED_SENTENCE_WORDS).toBe(6);
  });

  it("frees a sentence from its lead-in", () => {
    const line =
      "For the slide: The discount ladder stops at 12% because anything deeper erases the pilot margin.";
    const pieces = sentencesOf(line);
    expect(pieces).toContain(
      "The discount ladder stops at 12% because anything deeper erases the pilot margin.",
    );
  });

  it("frees a verdict line too", () => {
    const line =
      "The verdict line: Usage-based pricing looks cleaner on the slide but has no floor when volumes halve.";
    expect(sentencesOf(line)).toContain(
      "Usage-based pricing looks cleaner on the slide but has no floor when volumes halve.",
    );
  });

  it("never lets a fragment count as evidence", () => {
    expect(qualifiesAsSharedSentence("Captured.")).toBe(false);
  });

  it("turns down a long piece with too few words", () => {
    const piece = "Antidisestablishmentarianism plus another wordy bit";
    expect(piece.length).toBeGreaterThanOrEqual(40);
    expect(piece.split(/\s+/).length).toBeLessThan(6);
    expect(qualifiesAsSharedSentence(piece)).toBe(false);
  });

  it("turns down a piece with no letters", () => {
    expect(qualifiesAsSharedSentence("12 34 56 78 90 12 34 56 78 90 12 34 56")).toBe(false);
  });

  it("accepts a real shared sentence", () => {
    expect(
      qualifiesAsSharedSentence(
        "The discount ladder stops at 12% because anything deeper erases the pilot margin.",
      ),
    ).toBe(true);
  });

  it("puts evidence first, longest first", () => {
    const links = [
      { id: "a", quote: null },
      { id: "b", quote: { text: "short one here" } },
      { id: "c", quote: null },
      { id: "d", quote: { text: "a considerably longer shared sentence than the other" } },
    ];
    expect(orderByQuote(links).map((l) => l.id)).toEqual(["d", "b", "a", "c"]);
  });
});
