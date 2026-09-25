import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { earlierReadsNote, EARLIER_READS_HEADING } from "@/lib/earlier-reads";

let live = false;
vi.mock("@/hooks/use-coaching-links", () => ({ useHasLiveCoachLink: () => live }));

const m = (items: string[], excluded: string[] = [], brief = false) => ({
  engagement: null,
  brief_included: brief,
  firm_checks_applied: 0,
  items: items.map((t) => ({ id: t, title: t, kind: "document", detail: "read in full" })),
  excluded: excluded.map((t) => ({ title: t, reason: "listed in the record, not opened for this question" })),
  assembled_at: "",
});

describe("earlierReadsNote", () => {
  it("returns null with no manifests", () => {
    expect(earlierReadsNote([{ role: "user", content: "q" }, { role: "assistant", content: "a" }])).toBeNull();
  });
  it("lists read and not-read with details and reasons", () => {
    const note = earlierReadsNote([
      { role: "user", content: "What changed?" },
      { role: "assistant", content: "a", context_manifest: m(["Deck A", "Memo B"], ["Call C"], true) },
    ])!;
    expect(note.startsWith(EARLIER_READS_HEADING)).toBe(true);
    expect(note).toContain("Read: Deck A (read in full); Memo B (read in full)");
    expect(note).toContain("Brief: read");
    expect(note).toContain("Not read: Call C (listed in the record, not opened for this question)");
  });
  it("numbers in answer order", () => {
    const note = earlierReadsNote([
      { role: "user", content: "first" },
      { role: "assistant", content: "a", context_manifest: m(["X"]) },
      { role: "user", content: "second" },
      { role: "assistant", content: "b", context_manifest: m(["Y"]) },
    ])!;
    expect(note.indexOf('Answer 1, to "first"')).toBeLessThan(note.indexOf('Answer 2, to "second"'));
  });
  it("tolerates malformed manifests", () => {
    expect(
      earlierReadsNote([
        { role: "assistant", content: "a", context_manifest: "{not json" },
        { role: "assistant", content: "b", context_manifest: { items: [1, null] } },
      ]),
    ).toBeNull();
  });
});

describe("AskPrivacyLine", () => {
  it("short line without a live coach link", async () => {
    live = false;
    const { AskPrivacyLine } = await import("@/components/reflect/AskSurface");
    render(<AskPrivacyLine />);
    expect(screen.getByText("Ask about this engagement. Private to you.")).toBeTruthy();
  });
  it("coach line with a live coach link", async () => {
    live = true;
    const { AskPrivacyLine } = await import("@/components/reflect/AskSurface");
    render(<AskPrivacyLine />);
    expect(screen.getByText("Ask about this engagement. Private to you, your coach never sees this.")).toBeTruthy();
  });
});
