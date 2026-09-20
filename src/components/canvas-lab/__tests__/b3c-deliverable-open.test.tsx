// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabCard } from "@/components/canvas-lab/LabCard";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

function node(overrides: Partial<LabNode>): LabNode {
  return { id: "n", kind: "work", frame: "f", title: "Pricing deck", summary: "", typeLabel: "deck", ownership: "yours", x: 0, y: 0, width: 232, height: 160, ...overrides };
}

function renderCard(labNode: LabNode, onOpen: () => void) {
  return render(
    <LabCard
      node={labNode}
      selected={false}
      focused
      connecting={false}
      connectSourceAnchor={null}
      canResize
      onSelect={() => undefined}
      onOpen={onOpen}
      onBranch={() => undefined}
      onHide={() => undefined}
      onDelete={() => undefined}
      onEdit={() => undefined}
      onEditCommitted={() => undefined}
      onAnchorPointerDown={() => undefined}
      onAnchorActivate={() => undefined}
      onMenuOpened={() => undefined}
      onMenuOpenChange={() => undefined}
      onMeasure={() => undefined}
      onPointerDown={() => undefined}
      onFocus={() => undefined}
      onKeyDown={() => undefined}
      onResizeStart={() => undefined}
      onFit={() => undefined}
      onResizeKeyDown={() => undefined}
      onResizeKeyUp={() => undefined}
      frameChoices={[]}
      structured
      onMoveToFrame={() => undefined}
    />,
  );
}

describe("B3c deliverable trail entry", () => {
  afterEach(cleanup);

  it("opens the review on a clean double-click of a deliverable card", () => {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as typeof ResizeObserver;
    const onOpen = vi.fn();
    const { getByTestId } = renderCard(node({ deliverable: true }), onOpen);
    const card = getByTestId("lab-card-n");
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(card, { clientX: 10, clientY: 10 });
    fireEvent.doubleClick(card, { clientX: 10, clientY: 10 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("opens the review from the footer button", () => {
    const onOpen = vi.fn();
    const { getByTestId } = renderCard(node({ deliverable: true }), onOpen);
    fireEvent.click(getByTestId("lab-what-fed-this"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows no footer button and no double-click open on a non-deliverable card", () => {
    const onOpen = vi.fn();
    const { getByTestId, queryByTestId } = renderCard(node({}), onOpen);
    const card = getByTestId("lab-card-n");
    expect(queryByTestId("lab-what-fed-this")).toBeNull();
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(card, { clientX: 10, clientY: 10 });
    fireEvent.doubleClick(card, { clientX: 10, clientY: 10 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("ignores the double-click when the pointer moved like a drag", () => {
    const onOpen = vi.fn();
    const { getByTestId } = renderCard(node({ deliverable: true }), onOpen);
    const card = getByTestId("lab-card-n");
    fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(card, { clientX: 60, clientY: 10 });
    fireEvent.doubleClick(card, { clientX: 60, clientY: 10 });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
