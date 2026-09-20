import { describe, expect, it } from "vitest";

import { firstSlideFromMap, firstTwentyLines, isWorkboardFilePreviewItem } from "@/lib/workboard-file-preview";
import type { WorkItemRow } from "@/lib/work-types";

function item(type: WorkItemRow["type"]): WorkItemRow {
  return {
    id: type,
    title: `${type} title`,
    type,
    source: "upload",
    visibility: "mapped",
    captured_at: "2026-09-20T00:00:00Z",
    content_ref: null,
    work_item_tasks: [],
  };
}

describe("P2 Workboard file preview shaping", () => {
  it("admits only document, deck, and sheet cards to the visible preview queue", () => {
    expect(isWorkboardFilePreviewItem(item("document"))).toBe(true);
    expect(isWorkboardFilePreviewItem(item("deck"))).toBe(true);
    expect(isWorkboardFilePreviewItem(item("sheet"))).toBe(true);
    expect(isWorkboardFilePreviewItem(item("ai_thread"))).toBe(false);
  });

  it("keeps the first twenty non-empty extracted lines", () => {
    const lines = Array.from({ length: 24 }, (_, index) => index % 5 === 0 ? "" : `Line ${index + 1}`);
    const result = firstTwentyLines(lines.join("\n"));
    expect(result).toHaveLength(19);
    expect(result[0]).toBe("Line 2");
  });

  it("lays out the first slide title and body from a slide map", () => {
    expect(firstSlideFromMap({ slides: [{ title: "Recommendation", bullets: ["First", "Second"] }] })).toEqual({
      title: "Recommendation",
      lines: ["First", "Second"],
    });
  });
});