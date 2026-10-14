// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkNote } from "@/components/work/WorkNote";
import type { WorkItemRow } from "@/lib/work-types";

vi.mock("@/components/canvas-lab/WorkboardFilePreview", () => ({
  WorkboardFilePreview: ({ title }: { title: string }) => <div data-testid="file-thumbnail">{title}</div>,
}));

function bare(source: string, type: WorkItemRow["type"] = "ai_thread"): WorkItemRow {
  return {
    id: `${source}-${type}`,
    title: `${source} note`,
    type,
    source,
    source_vendor: source,
    visibility: "mapped",
    captured_at: "2026-09-24T10:00:00Z",
    content_ref: null,
    source_meta: { url: "https://example.com/source" },
    meta: {},
    work_item_tasks: [{ task_id: "t1", tasks: { id: "t1", name: "Task", engagement_id: "e1", engagements: { id: "e1", code: "ALPHA", title: "Alpha" } } }],
  } as WorkItemRow;
}

describe("scratch CP-1 empty summary copy", () => {
  it("shows the new sentence on a desktop card with no summary and no readable turn", () => {
    const { container } = render(<WorkNote item={bare("claude")} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Open it to see what landed.");
    expect(text).not.toContain("No summary available.");
  });

  it("still prefers a stored extract summary when one exists", () => {
    const withExtract = { ...bare("claude"), work_item_extracts: [{ id: "x1", summary: "Stored extract" }] } as unknown as WorkItemRow;
    const { container } = render(<WorkNote item={withExtract} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Stored extract");
    expect(text).not.toContain("Open it to see what landed.");
  });
});
