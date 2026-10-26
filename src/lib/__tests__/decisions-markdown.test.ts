import { describe, expect, it } from "vitest";
import { diffDecisionLines, parseDecisionsMarkdown, renderDecisionsMarkdown, type MarkdownDecisionLine } from "../mcp-decisions";
const line = (call_text: string, ord = 1, status: MarkdownDecisionLine["status"] = "draft", why = ""): MarkdownDecisionLine => ({ call_text, ord, status, why });
describe("decisions markdown", () => {
  for (const count of [0, 1, 3, 40]) it(`round trips ${count} generated lines`, () => {
    const statuses = ["draft", "confirmed", "discarded"] as const;
    const lines = Array.from({ length: count }, (_, i) => line(`Decision ${i + 1}`, i + 1, statuses[i % 3] ?? "draft", i % 2 ? "Reason: keep this" : ""));
    expect(parseDecisionsMarkdown(renderDecisionsMarkdown("A title", lines))).toEqual({ title: "A title", lines });
  });
  it("keeps a blank line and numbered non-entry in the reason", () => {
    const lines = [line("First", 1, "confirmed", "Reason\n\n2. Not another decision\nStill the reason"), line("Second", 2)];
    expect(parseDecisionsMarkdown(renderDecisionsMarkdown("Title", lines))).toEqual({ title: "Title", lines });
  });
  it("tolerates trailing whitespace and a blank before Status", () => {
    expect(parseDecisionsMarkdown("# Title  \n\n1. Decision  \n\n   Status: Dropped  \n   Why: Reason: yes  \n\n")).toEqual({ title: "Title", lines: [line("Decision", 1, "discarded", "Reason: yes")] });
  });
  const before = [line("Same"), line("Status", 2), line("Reason", 3), line("Moved", 4), line("Removed", 5)];
  const after = [line("  SAME "), line("Status", 2, "confirmed"), line("Reason", 3, "draft", "New reason"), line("Moved", 5), line("Added", 6)];
  for (const [index, change] of ["unchanged", "edited", "edited", "moved", "added"].entries()) it(`marks line ${index + 1} ${change}`, () => { expect(diffDecisionLines(before, after).lines[index]?.change).toBe(change); });
  it("reports removed statements", () => { expect(diffDecisionLines(before, after).removed).toEqual([line("Removed", 5)]); });
});