// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LabFrame } from "@/components/canvas-lab/LabFrame";
import type { LabFrame as LabFrameModel, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { groupingDragSnapshot, moveGroupingContents, newRegionFrameId, regionClaims } from "@/lib/board-region";

const frame = (name = "Pricing"): LabFrameModel => ({
  id: newRegionFrameId("pricing"),
  name,
  x: 100,
  y: 80,
  width: 300,
  height: 220,
});

const card = (id: string, x: number, y: number, width = 100, height = 60): LabNode => ({
  id,
  kind: "work",
  frame: null,
  title: id,
  summary: "",
  typeLabel: "work",
  ownership: "yours",
  x,
  y,
  width,
  height,
});

function renderFrame(model: LabFrameModel) {
  return render(
    <LabFrame
      frame={model}
      count={0}
      selected={false}
      editable
      custom
      namedByWorkstream={false}
      removable
      kind="custom"
      region
      onSelect={vi.fn()}
      onDragStart={vi.fn()}
      onResizeStart={vi.fn()}
      onFit={vi.fn()}
      onRename={vi.fn()}
      onRemove={vi.fn()}
      onMenuOpened={vi.fn()}
      onMenuOpenChange={vi.fn()}
    />,
  );
}

describe("R2 grouping movement", () => {
  it("moves a card whose centre starts inside and preserves its grouping offset", () => {
    const grouping = frame();
    const inside = card("inside", 350, 120, 100, 60);
    const snapshot = groupingDragSnapshot(grouping, [inside]);
    const moved = moveGroupingContents([inside], snapshot, { x: 175, y: 115 });

    expect(snapshot.map((entry) => entry.id)).toEqual(["inside"]);
    expect(moved[0]).toMatchObject({ x: 425, y: 155 });
    expect((moved[0]?.x ?? 0) - 175).toBe(inside.x - grouping.x);
    expect((moved[0]?.y ?? 0) - 115).toBe(inside.y - grouping.y);
  });

  it("does not move an overlapping card whose centre starts outside", () => {
    const grouping = frame();
    const outside = card("outside", 370, 120, 100, 60);
    const snapshot = groupingDragSnapshot(grouping, [outside]);

    expect(snapshot).toEqual([]);
    expect(moveGroupingContents([outside], snapshot, { x: 175, y: 115 })[0]).toEqual(outside);
  });

  it("uses geometry for named and unnamed groupings and moves an overlap with only the dragged one", () => {
    const named = frame("Pricing");
    const paint = { ...frame(""), id: newRegionFrameId("paint"), x: 250 };
    const shared = card("shared", 280, 130);

    expect(groupingDragSnapshot(named, [shared])).toHaveLength(1);
    const paintSnapshot = groupingDragSnapshot(paint, [shared]);
    expect(paintSnapshot).toHaveLength(1);
    expect(moveGroupingContents([shared], paintSnapshot, { x: 300, y: 80 })[0]).toMatchObject({ x: 330, y: 130 });
  });

  it("keeps resize separate from card movement and persists each moved row", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const resizePath = page.slice(page.indexOf("const resizing = resizeRef.current"), page.indexOf("const trailDrag = frameDragRef.current"));
    const dragEnd = page.match(/function endInteraction\(event[^)]*\)[\s\S]*?const connector = connectorDragRef\.current/)?.[0] ?? "";

    expect(resizePath).not.toContain("moveGroupingContents");
    expect(dragEnd).toContain("persistFramePatch");
    expect(dragEnd).toContain("persistNodePatch");
  });

  it("shows no guidance for unnamed paint and preserves named guidance", () => {
    const unnamed = renderFrame(frame(""));
    expect(screen.queryByText(/Nothing here yet/)).toBeNull();
    expect(unnamed.container.textContent).not.toContain("Move to .");
    unnamed.unmount();

    renderFrame(frame("Pricing"));
    expect(screen.getByText("Nothing here yet. Drag a card in and choose Move to Pricing.")).not.toBeNull();
  });

  it("leaves the paint claim rule untouched after geometric movement", () => {
    const paint = frame("");
    const inside = card("inside", 140, 120);
    const snapshot = groupingDragSnapshot(paint, [inside]);
    const [moved] = moveGroupingContents([inside], snapshot, { x: 200, y: 180 });
    const claims = regionClaims(
      { id: paint.id, label: paint.name },
      { x: 200, y: 180, width: paint.width, height: paint.height },
      moved ? [{ ...moved, workItemId: "work-inside" }] : [],
    );

    expect(claims).toEqual({ silent: [], ask: [], frameOnly: [] });
  });
});