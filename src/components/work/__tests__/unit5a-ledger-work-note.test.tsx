// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { brandHex } from "@/components/connectors/BrandLogo";
import { WorkNote } from "@/components/work/WorkNote";
import type { WorkItemRow } from "@/lib/work-types";
import type { WorkboardFilePreview } from "@/lib/workboard-card-preview.shared";

vi.mock("@/components/canvas-lab/WorkboardFilePreview", () => ({
  WorkboardFilePreview: ({ title }: { title: string }) => <div data-testid="file-thumbnail">{title}</div>,
}));

function item(source: string, type: WorkItemRow["type"] = "ai_thread"): WorkItemRow {
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

const preview: WorkboardFilePreview = {
  workItemId: "drive-document",
  kind: "text",
  url: null,
  lines: ["First page"],
  slideTitle: null,
  versionCount: 1,
};

function rgb(hex: string): string {
  const value = hex.slice(1);
  return `rgb(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(value.slice(2, 4), 16)}, ${Number.parseInt(value.slice(4, 6), 16)})`;
}

describe("Unit 5a Ledger WorkNote", () => {
  it.each([
    ["claude", "claude"],
    ["chatgpt", "chatgpt"],
    ["googledrive", "googledrive"],
  ] as const)("renders the %s brand edge through its style attribute", (source, brand) => {
    const { container } = render(<WorkNote item={item(source)} />);
    expect(container.querySelector<HTMLElement>(".ledger-work-note")?.style.borderLeftColor).toBe(rgb(brandHex(brand)));
  });

  it("has no folded corner and renders a document thumbnail column", () => {
    const { container, getByTestId } = render(<WorkNote item={item("googledrive", "document")} filePreview={preview} />);
    expect(container.querySelector(".fold")).toBeNull();
    expect(container.querySelector(".ledger-work-note__thumbnail")).not.toBeNull();
    expect(getByTestId("file-thumbnail")).toBeTruthy();
  });
});
