// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabRelationPicker } from "@/components/canvas-lab/LabRelationPicker";
import { LabRelationshipOverlays } from "@/components/canvas-lab/LabRelationshipOverlays";
import { labAnchorPoint, labConnectorAffordancePoint, type LabLink, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { recordUndo, undoActionWord, type UndoEntry } from "@/components/canvas-lab/canvas-lab-undo";

const nodes: LabNode[] = [
  { id: "a", kind: "work", frame: "f", title: "Source", summary: "", typeLabel: "document", ownership: "yours", x: 0, y: 0, width: 232, height: 112 },
  { id: "b", kind: "decision", frame: "f", title: "Target", summary: "", typeLabel: "call", ownership: "yours", x: 400, y: 120, width: 232, height: 112 },
];
const link: LabLink = { id: "link", fromId: "a", fromAnchor: "right", toId: "b", toAnchor: "left", relation: "informed" };

afterEach(cleanup);

describe("what a link means", () => {
  it("draws every link the same way, with no word on the line", () => {
    for (const relation of ["informed", "context"] as const) {
      const { container } = render(<svg><LabRelationshipOverlays links={[{ ...link, relation }]} nodes={nodes} measuredHeights={new Map()} selectedLinkId={null} hoveredLinkId={null} inverseZoom={1} zoom={1} editable onRemove={() => undefined} /></svg>);
      expect(container.querySelector("[data-testid='lab-relationship-label-link']")).toBeNull();
      cleanup();
    }
  });

  it("offers only the remove control when selected", () => {
    render(<svg><LabRelationshipOverlays links={[link]} nodes={nodes} measuredHeights={new Map()} selectedLinkId="link" hoveredLinkId={null} inverseZoom={1} zoom={1} editable onRemove={() => undefined} /></svg>);
    expect(screen.queryByRole("button", { name: /Change relation/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove relationship from Source to Target" })).toBeTruthy();
  });

  it("moves with the arrow keys and picks with Enter", () => {
    const pick = vi.fn();
    render(<LabRelationPicker point={{ x: 10, y: 10 }} current="context" onPick={pick} onClose={() => undefined} />);
    const shell = screen.getByRole("listbox", { name: "What does this link mean?" });
    fireEvent.keyDown(shell, { key: "ArrowDown" });
    fireEvent.keyDown(shell, { key: "Enter" });
    expect(pick).toHaveBeenCalledWith("informed");
    expect(screen.getByText("What does this link mean?")).toBeTruthy();
  });

  it("leaves the link alone on Escape", () => {
    const close = vi.fn();
    const pick = vi.fn();
    render(<LabRelationPicker point={{ x: 0, y: 0 }} current="context" onPick={pick} onClose={close} />);
    fireEvent.keyDown(screen.getByRole("listbox", { name: "What does this link mean?" }), { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
    expect(pick).not.toHaveBeenCalled();
  });

  it("puts a relation change on the stack in plain words", () => {
    const entry: UndoEntry = { id: "u1", action: "link_relation", linkId: "link", before: "context", after: "produced" };
    const stacks = recordUndo({ undo: [], redo: [] }, entry);
    expect(stacks.undo[0]?.action).toBe("link_relation");
    expect(undoActionWord("link_relation")).toBe("what this link means");
  });

  const placementSamples: [LabNode, LabNode, "right" | "bottom", "top" | "left"][] = [
    [{ ...(nodes[0] as LabNode), x: 0, y: 0 }, { ...(nodes[1] as LabNode), x: 400, y: 120 }, "right", "top"],
    [{ ...(nodes[0] as LabNode), x: 80, y: 0 }, { ...(nodes[1] as LabNode), x: 260, y: 190 }, "bottom", "left"],
  ];

  it.each(placementSamples)("nudges the label box clear of both end cards", (source, target, fromSide, toSide) => {
    const from = labAnchorPoint(source, fromSide, source.height);
    const to = labAnchorPoint(target, toSide, target.height);
    const size = { width: 68, height: 20 };
    const point = labConnectorAffordancePoint(from, fromSide, to, toSide, size, source, target);
    const box = { left: point.x - size.width / 2, right: point.x + size.width / 2, top: point.y - size.height / 2, bottom: point.y + size.height / 2 };
    const intersects = (rect: LabNode) => box.left < rect.x + rect.width && box.right > rect.x && box.top < rect.y + rect.height && box.bottom > rect.y;
    expect(intersects(source)).toBe(false);
    expect(intersects(target)).toBe(false);
  });
});
