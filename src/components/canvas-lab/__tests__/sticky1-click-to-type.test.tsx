// @vitest-environment jsdom
// STICKY-1: click once to select, click the words of a selected sticky to type; a drag never types.
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabSticky } from "@/components/canvas-lab/LabSticky";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { stickyClickTypes, STICKY_DRAG_THRESHOLD_PX } from "@/lib/card-click";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

const sticky = { id: "sticky:1", kind: "sticky", frame: null, title: "Sticky", summary: "check the margin", typeLabel: "sticky", ownership: "yours", textSize: "body", textWeight: "regular", textColour: "ink", stickyFill: "yellow", x: 0, y: 0, width: 200, height: 140, local: true } as unknown as LabNode;
const noop = () => {};
const renderSticky = (selected: boolean, extra: { editable?: boolean; onSelect?: () => void; onDragStart?: () => void } = {}) =>
  render(<LabSticky node={sticky} selected={selected} editable={extra.editable ?? true} layoutEditable onSelect={extra.onSelect ?? noop} onDragStart={extra.onDragStart ?? noop} onResizeStart={noop} onResizeKeyDown={noop} onResizeKeyUp={noop} onChange={noop} onCommit={noop} onRemove={noop} />);

describe("STICKY-1 click to type", () => {
  afterEach(cleanup);

  it("the first click on an unselected sticky selects it and does not type", () => {
    const onSelect = vi.fn();
    const { container } = renderSticky(false, { onSelect });
    const face = container.querySelector("textarea[readonly]")!;
    fireEvent.pointerDown(face, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(face, { button: 0, clientX: 10, clientY: 10 });
    expect(onSelect).toHaveBeenCalled();
    expect(container.querySelector("section")!.getAttribute("data-editing")).toBe("false");
  });

  it("a click on the words of a selected sticky starts typing and marks it editing", () => {
    const { container } = renderSticky(true);
    const face = container.querySelector("textarea[readonly]")!;
    fireEvent.pointerDown(face, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(face, { button: 0, clientX: 11, clientY: 11 });
    expect(container.querySelector("section")!.getAttribute("data-editing")).toBe("true");
  });

  it("dragging a selected sticky moves it and never types", () => {
    const onDragStart = vi.fn();
    const { container } = renderSticky(true, { onDragStart });
    const face = container.querySelector("textarea[readonly]")!;
    fireEvent.pointerDown(face, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(face, { button: 0, clientX: 40, clientY: 10 });
    expect(onDragStart).toHaveBeenCalledOnce();
    expect(container.querySelector("section")!.getAttribute("data-editing")).toBe("false");
  });

  it("someone else's sticky never opens for typing", () => {
    const { container } = renderSticky(true, { editable: false });
    const face = container.querySelector("textarea[readonly]")!;
    fireEvent.pointerDown(face, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(face, { button: 0, clientX: 10, clientY: 10 });
    expect(container.querySelector("section")!.getAttribute("data-editing")).toBe("false");
  });

  it("uses a 4px threshold between a click and a drag", () => {
    expect(STICKY_DRAG_THRESHOLD_PX).toBe(4);
    expect(stickyClickTypes({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(true);
    expect(stickyClickTypes({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
  });
});
