// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  visibility: "mapped",
  captured_at: "2026-09-19T00:00:00Z",
  content_ref: null,
  work_item_tasks: [],
};

afterEach(cleanup);

function paper(node: LabNode, item?: WorkItemRow) {
  return render(<LabPaper node={node} item={item} selected={false} onEdit={() => undefined} onEditCommitted={() => undefined} />);
}

describe("Canvas Lab paper", () => {
  it("renders the last three chat turns and footer in Preview mode", () => {
    render(
      <LabPaper
        node={{ ...baseNode, kind: "work", workItemId: workItem.id }}
        item={{ ...workItem, type: "ai_thread", source_vendor: "anthropic" }}
        selected={false}
        displayMode="preview"
        preview={{
          workItemId: workItem.id,
          turnCount: 8,
          model: "Sonnet",
          turns: [
            { turnNo: 6, role: "user", content: "First visible turn" },
            { turnNo: 7, role: "assistant", content: "Second visible turn" },
            { turnNo: 8, role: "user", content: "Last visible turn" },
          ],
        }}
        onEdit={() => undefined}
        onEditCommitted={() => undefined}
      />,
    );
    expect(screen.getByTestId("workboard-chat-preview")).not.toBeNull();
    expect(screen.getByText("8 turns")).not.toBeNull();
    expect(screen.getByText("Last visible turn")).not.toBeNull();
  });

  it("reports a focused chat preview only after its scroll position changes", () => {
    const onPreviewScroll = vi.fn();
    render(
      <LabPaper
        node={{ ...baseNode, kind: "work", workItemId: workItem.id }}
        item={{ ...workItem, type: "ai_thread", source_vendor: "openai" }}
        selected={false}
        focused
        displayMode="preview"
        preview={{ workItemId: workItem.id, turnCount: 3, model: "Model", turns: [] }}
        onPreviewScroll={onPreviewScroll}
        onEdit={() => undefined}
        onEditCommitted={() => undefined}
      />,
    );
    const preview = screen.getByTestId("workboard-chat-preview");
    fireEvent.scroll(preview, { target: { scrollTop: 0 } });
    expect(onPreviewScroll).not.toHaveBeenCalled();
    Object.defineProperty(preview, "scrollTop", { configurable: true, value: 24 });
    fireEvent.scroll(preview);
    expect(onPreviewScroll).toHaveBeenCalledWith("chat");
  });

  it("does not report wheel movement over a document excerpt", () => {
    const onPreviewScroll = vi.fn();
    const { container } = render(<LabPaper node={{ ...baseNode, kind: "work", workItemId: workItem.id }} item={{ ...workItem, work_item_extracts: [{ summary: "Longer document excerpt" }] }} selected={false} focused displayMode="preview" onPreviewScroll={onPreviewScroll} onEdit={() => undefined} onEditCommitted={() => undefined} />);
    fireEvent.wheel(container.querySelector(".canvas-lab-paper-summary") as Element, { deltaY: 20 });
    expect(onPreviewScroll).not.toHaveBeenCalled();
  });

  it("shows a real text page only in Preview mode and keeps the excerpt as fallback", () => {
    const item = { ...workItem, work_item_extracts: [{ summary: "Existing six-line excerpt" }] };
    const node = { ...baseNode, kind: "work" as const, workItemId: item.id };
    const sticky = render(<LabPaper node={node} item={item} selected={false} displayMode="sticky" filePreview={{ workItemId: item.id, kind: "text", url: null, lines: ["First page line"], slideTitle: null, versionCount: 0 }} onEdit={() => undefined} onEditCommitted={() => undefined} />);
    expect(sticky.queryByTestId("workboard-text-preview")).toBeNull();
    sticky.unmount();

    render(<LabPaper node={node} item={item} selected={false} displayMode="preview" filePreview={{ workItemId: item.id, kind: "text", url: null, lines: ["First page line"], slideTitle: null, versionCount: 0 }} onEdit={() => undefined} onEditCommitted={() => undefined} />);
    expect(screen.getByTestId("workboard-text-preview")).not.toBeNull();
    cleanup();

    render(<LabPaper node={node} item={item} selected={false} displayMode="preview" filePreview={{ workItemId: item.id, kind: "fallback", url: null, lines: [], slideTitle: null, versionCount: 0 }} onEdit={() => undefined} onEditCommitted={() => undefined} />);
    expect(screen.getByText("Existing six-line excerpt")).not.toBeNull();
  });

  it("shows the document version count as a quiet chip", () => {
    render(<LabPaper node={{ ...baseNode, kind: "work", workItemId: workItem.id }} item={workItem} selected={false} displayMode="preview" filePreview={{ workItemId: workItem.id, kind: "fallback", url: null, lines: [], slideTitle: null, versionCount: 3 }} onEdit={() => undefined} onEditCommitted={() => undefined} />);
    expect(screen.getByTestId("workboard-version-chip").textContent).toBe("v3");
  });

  it.each([
    ["work", "GOOGLEDRIVE", workItem],
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
    expect(screen.getByText(new RegExp(`^${label}$`, "i"))).not.toBeNull();
    expect(screen.getByText(kind === "chat" || kind === "judgment" ? "local draft" : "yours")).not.toBeNull();
  });

  it("shows a footer only at the expanded tier", () => {
    const compact = paper({ ...baseNode, width: 200, height: 112 }, workItem);
    expect(compact.container.querySelector(".canvas-lab-paper-summary")).toBeNull();
    expect(compact.container.querySelector(".canvas-lab-paper-footer")).toBeNull();
    compact.unmount();

    const expanded = paper({ ...baseNode, width: 340, height: 240 }, workItem);
    expect(expanded.container.querySelector(".canvas-lab-paper-footer")).not.toBeNull();
  });

  it("shows a compact decision summary in two lines", () => {
    const { container } = paper({ ...baseNode, kind: "decision", width: 232, height: 112 });
    const summary = screen.getByText(baseNode.summary);
    expect(summary.classList.contains("line-clamp-2")).toBe(true);
    expect(container.querySelector(".canvas-lab-paper-summary")).toBe(summary);
  });

  it("lets a compact own judgment editor use the remaining body space", () => {
    const { container } = paper({ ...baseNode, kind: "judgment", ownership: "yours", local: true, width: 232, height: 112 });
    const body = container.querySelector(".canvas-lab-paper-body");
    const editor = screen.getByRole("textbox");
    expect(body?.classList.contains("canvas-lab-paper-body")).toBe(true);
    expect(editor.classList.contains("flex-1")).toBe(true);
    expect(editor.classList.contains("basis-0")).toBe(true);
    expect(editor.classList.contains("min-h-0")).toBe(true);
    expect(editor.classList.contains("overflow-auto")).toBe(true);
    expect(editor.classList.contains("min-h-[34px]")).toBe(false);
  });

  it("renders a document glyph when an upload has no vendor mark", () => {
    const uploadItem = { ...workItem, source: "upload", source_vendor: null };
    const { container } = paper({ ...baseNode, kind: "work", workItemId: uploadItem.id }, uploadItem);
    expect(container.querySelector('svg[data-icon="work"]')).not.toBeNull();
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

  it("keeps the header and title from shrinking at compact", () => {
    const { container } = paper({ ...baseNode, width: 232, height: 112 });
    expect(container.querySelector(".canvas-lab-paper-header")?.classList.contains("shrink-0")).toBe(true);
    expect(container.querySelector(".canvas-lab-paper-title")?.classList.contains("shrink-0")).toBe(true);
  });

  it("truncates the header source label with an ellipsis", () => {
    const { container } = paper(baseNode);
    const label = container.querySelector(".canvas-lab-paper-source > span") as HTMLElement;
    expect(label.classList.contains("min-w-0")).toBe(true);
    expect(label.classList.contains("overflow-hidden")).toBe(true);
    expect(label.classList.contains("text-ellipsis")).toBe(true);
    expect(label.classList.contains("whitespace-nowrap")).toBe(true);
  });

  it("drops the header date at compact and keeps it in the expanded footer", () => {
    const compact = paper({ ...baseNode, width: 232, height: 112 }, workItem);
    const compactLabel = compact.container.querySelector(".canvas-lab-paper-source") as HTMLElement;
    expect(compactLabel.textContent).not.toContain("·");
    compact.unmount();

    const expanded = paper({ ...baseNode, width: 340, height: 240 }, workItem);
    const expandedLabel = expanded.container.querySelector(".canvas-lab-paper-source") as HTMLElement;
    expect(expandedLabel.textContent).toContain("·");
    const footer = expanded.container.querySelector(".canvas-lab-paper-footer") as HTMLElement;
    expect(footer.textContent).not.toBe("");
  });
});
describe("deleted source label", () => {
  it("shows Item deleted only when the linked item was removed", () => {
    const node: LabNode = { ...baseNode, kind: "work", workItemId: "work" };
    const plain = paper(node, workItem);
    expect(plain.queryByText("Item deleted")).toBeNull();
    cleanup();
    paper({ ...node, linkedItemRemovedAt: "2026-09-19T00:00:00Z" }, workItem);
    expect(screen.getByText("Item deleted")).not.toBeNull();
  });
});
