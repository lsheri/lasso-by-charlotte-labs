import { describe, expect, it } from "vitest";
import { LINEAGE_SYSTEM_PROMPT } from "../lineage-shared";

describe("LINEAGE_SYSTEM_PROMPT (pass L1 hard-evidence rules)", () => {
  it("keeps the opening sentence", () => {
    expect(
      LINEAGE_SYSTEM_PROMPT.startsWith(
        "You read one deliverable and a numbered list of other pieces of work from the same engagement, and you say which of them actually fed the deliverable."
      )
    ).toBe(true);
  });

  it("contains the hard-evidence clause with the three allowed forms", () => {
    expect(LINEAGE_SYSTEM_PROMPT).toContain("Propose a link only on hard evidence");
    expect(LINEAGE_SYSTEM_PROMPT).toContain("one of exactly three things");
    expect(LINEAGE_SYSTEM_PROMPT).toContain("appears word for word in both texts");
    expect(LINEAGE_SYSTEM_PROMPT).toContain("names the candidate artefact by its name or file name");
    expect(LINEAGE_SYSTEM_PROMPT).toContain("actually drafted");
  });

  it("excludes shared numbers and near-evidence as standalone proof", () => {
    expect(LINEAGE_SYSTEM_PROMPT).toContain(
      "A shared number, a shared topic, a similar structure, similar tier names, or a conclusion that merely appears in both are not evidence on their own"
    );
    expect(LINEAGE_SYSTEM_PROMPT).toContain("A figure only counts when the sentence around it is shared too.");
    expect(LINEAGE_SYSTEM_PROMPT).toContain("Never propose a link on topic similarity alone, and never on timing alone.");
  });

  it("requires the rationale to quote shared wording or name the artefact", () => {
    expect(LINEAGE_SYSTEM_PROMPT).toContain("it must quote the shared wording or name the artefact it saw");
  });

  it("prefers an empty list over guessing", () => {
    expect(LINEAGE_SYSTEM_PROMPT).toContain("An empty list is a good answer. Most candidates fed nothing.");
  });

  it("no longer admits the loose evidence forms", () => {
    expect(LINEAGE_SYSTEM_PROMPT).not.toContain("shared figures");
    expect(LINEAGE_SYSTEM_PROMPT).not.toContain("appears as content in the other");
  });

  it("stays within the language laws", () => {
    expect(LINEAGE_SYSTEM_PROMPT.match(/score/gi)).toEqual(["scores"]);
    expect(LINEAGE_SYSTEM_PROMPT).not.toContain("—");
    expect(LINEAGE_SYSTEM_PROMPT).not.toContain("–");
  });
});
