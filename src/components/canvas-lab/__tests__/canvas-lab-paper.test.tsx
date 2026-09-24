// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LabPaper } from "@/components/canvas-lab/LabPaper";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

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
  height: 180,
};

afterEach(cleanup);

describe("Canvas Lab board-native paper", () => {
  it("keeps board-native labels, ownership, and summary", () => {
    const { container } = render(<LabPaper node={baseNode} selected={false} onEdit={() => undefined} onEditCommitted={() => undefined} />);
    expect(container.querySelector('svg[data-icon="engagement"]')).not.toBeNull();
    expect(screen.getByText("brief")).not.toBeNull();
    expect(screen.getByText("yours")).not.toBeNull();
    expect(screen.getByText(baseNode.summary)).not.toBeNull();
  });

  it("keeps a local judgment editor in the remaining body space", () => {
    const { container } = render(<LabPaper node={{ ...baseNode, kind: "judgment", ownership: "draft", local: true }} selected={false} onEdit={() => undefined} onEditCommitted={() => undefined} />);
    const editor = screen.getByRole("textbox");
    expect(container.querySelector(".canvas-lab-paper-body")).not.toBeNull();
    expect(editor.classList.contains("flex-1")).toBe(true);
    expect(editor.classList.contains("min-h-0")).toBe(true);
  });

  it("keeps selected-card spacing and the deliverable trail action", () => {
    const { container } = render(<LabPaper node={{ ...baseNode, deliverable: true }} selected onEdit={() => undefined} onEditCommitted={() => undefined} onOpenTrail={() => undefined} />);
    expect(container.querySelector(".canvas-lab-context-title")).not.toBeNull();
    expect(container.querySelector(".canvas-lab-context-header")).not.toBeNull();
    expect(screen.getByRole("button", { name: `What fed ${baseNode.title}` })).not.toBeNull();
  });

  it("contains no imported-work preview, tint, fold, or display-mode branch", () => {
    const { container } = render(<LabPaper node={baseNode} selected={false} onEdit={() => undefined} onEditCommitted={() => undefined} />);
    expect(container.querySelector(".fold")).toBeNull();
    expect(container.querySelector(".canvas-lab-paper-preview")).toBeNull();
  });
});