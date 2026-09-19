// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => true }));

import { LabPaper } from "@/components/canvas-lab/LabPaper";
import type { LabNode, LabNodeKind } from "@/components/canvas-lab/canvas-lab-model";
import type { WorkItemRow } from "@/lib/work-types";

const baseNode: LabNode = {
  id: "node",
  kind: "brief",
  frame: "foundation",
  title: "Shape the recommendation",
  summary: "Use the evidence already in the record.",
  typeLabel: "brief",
  ownership: "yours",
  x: 0,
  y: 0,
  width: 232,
  height: 160,
};

const workItem: WorkItemRow = {
  id: "work",
  title: "Board paper",
  type: "document",
  source: "connector:googledrive",
  source_vendor: "googledrive",
  visibility: "shared",
  captured_at: "2026-09-19T00:00:00Z",
  content_ref: null,
  work_item_tasks: [],
};

afterEach(cleanup);

function paper(node: LabNode, item?: WorkItemRow) {
  return render(<LabPaper node={node} item={item} selected={false} onEdit={() => undefined} onEditCommitted={() => undefined} />);
}

describe("Canvas Lab paper", () => {
  it.each([
    ["work", "GOOGLE DRIVE", workItem],
    ["brief", "BRIEF", undefined],
    ["decision", "CALL", undefined],
    ["judgment", "ADDED CONSTRAINT", undefined],
    ["chat", "DRAFT CHAT", undefined],
  ] as [LabNodeKind, string, WorkItemRow | undefined][])("renders a glyph, label, and owner for %s", (kind, label, item) => {
    const node = {
      ...baseNode,
      kind,
      typeLabel: label.toLowerCase(),
      ownership: kind === "chat" ? "draft" as const : "yours" as const,
      ...(kind === "work" ? { workItemId: "work" } : {}),
    };
    const { container } = paper(node, item);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByText(label)).not.toBeNull();
    expect(screen.getByText(kind === "chat" ? "local draft" : "yours")).not.toBeNull();
  });

  it("shows a footer only at the expanded tier", () => {
    const compact = paper({ ...baseNode, width: 200, height: 112 }, workItem);
    expect(compact.container.querySelector(".canvas-lab-paper-summary")).toBeNull();
    expect(compact.container.querySelector(".canvas-lab-paper-footer")).toBeNull();
    compact.unmount();

    const expanded = paper({ ...baseNode, width: 340, height: 240 }, workItem);
    expect(expanded.container.querySelector(".canvas-lab-paper-footer")).not.toBeNull();
  });

  it("does not use a work node summary when the record has no summary field", () => {
    paper({ ...baseNode, kind: "work", workItemId: "work", summary: "Invented summary must not appear" }, workItem);
    expect(screen.queryByText("Invented summary must not appear")).toBeNull();
    expect(screen.getByText("Document")).not.toBeNull();
  });

  it("marks an existing deliverable flag in the header", () => {
    paper({ ...baseNode, kind: "work", workItemId: "work", deliverable: true }, workItem);
    expect(screen.getByText("Deliverable")).not.toBeNull();
  });
});