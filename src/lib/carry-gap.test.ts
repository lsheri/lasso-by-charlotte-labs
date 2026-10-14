import { describe, expect, it } from "vitest";
import { carryGapBucket, countCarryGaps, findFileEvidence } from "@/lib/carry-gap";

const t = ["Here is your deck: Q3_Board.pptx is ready."];

describe("countCarryGaps", () => {
  it("counts a named file with no attachment", () => {
    expect(countCarryGaps({ messageTexts: t, attachmentTitles: [], attachmentFilenames: [] })).toEqual({ gaps: 1, evidence: "filename" });
  });
  it("is satisfied by a matching file_ref filename", () => {
    expect(countCarryGaps({ messageTexts: t, attachmentTitles: ["x"], attachmentFilenames: ["Q3_Board.pptx"] })).toEqual({ gaps: 0, evidence: "none" });
  });
  it("is satisfied by a title matching the stem", () => {
    expect(countCarryGaps({ messageTexts: t, attachmentTitles: ["Q3 Board"], attachmentFilenames: [] }).gaps).toBe(0);
  });
  it("ignores a linked file", () => {
    expect(countCarryGaps({ messageTexts: ["https://example.com/report.pdf"], attachmentTitles: [], attachmentFilenames: [] })).toEqual({ gaps: 0, evidence: "none" });
  });
  it("counts only the unmatched of two files", () => {
    expect(countCarryGaps({ messageTexts: ["Made plan.docx and model.xlsx"], attachmentTitles: [], attachmentFilenames: ["plan.docx"] }).gaps).toBe(1);
  });
  it("never throws on bad input", () => {
    expect(countCarryGaps({ messageTexts: null as unknown as string[], attachmentTitles: [], attachmentFilenames: [] })).toEqual({ gaps: 0, evidence: "none" });
  });
});

describe("findFileEvidence performance", () => {
  it("returns nothing quickly on large plain input", () => {
    const start = Date.now();
    expect(findFileEvidence([" ".repeat(200_000)])).toEqual([]);
    expect(findFileEvidence(["a".repeat(200_000)])).toEqual([]);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe("carryGapBucket", () => {
  it("maps to the closed set", () => {
    expect([0, 1, 3, 9].map(carryGapBucket)).toEqual(["0", "1", "2-5", "6+"]);
  });
});
