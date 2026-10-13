// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabCard } from "@/components/canvas-lab/LabCard";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import type { WorkItemRow } from "@/lib/work-types";

// jsdom has no ResizeObserver; the card measures with it, so stub it.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

/**
 * W2: the workboard card, rendered for real. A drag that ends on the card
 * must not open it; a stationary click, a small wobble inside the threshold,
 * and a keyboard activation must. No source strings: every case dispatches
 * events against the mounted component.
 */

const node: LabNode = {
  id: "n1",
  kind: "work",
  title: "A piece of work",
  summary: "",
  typeLabel: "Document",
  ownership: "yours",
  x: 0,
  y: 0,
  width: 320,
  height: 200,
} as LabNode;

const item: WorkItemRow = {
  id: "w1",
  title: "A piece of work",
  type: "document",
  source: "upload",
  visibility: "private",
  captured_at: "2026-09-01T00:00:00Z",
  content_ref: null,
  work_item_tasks: [],
};

function renderCard({ onOpen = vi.fn(), onPointerDown = vi.fn(), onSelect = vi.fn(), readOnly = false } = {}) {
  const utils = render(
    <LabCard
      node={node}
      item={item}
      selected={false}
      focused={false}
      onSelect={onSelect}
      onOpen={onOpen}
      onBranch={() => {}}
      onHide={() => {}}
      onDelete={() => {}}
      onEdit={() => {}}
      onEditCommitted={() => {}}
      connecting={false}
      connectSourceAnchor={null}
      onAnchorPointerDown={() => {}}
      onAnchorActivate={() => {}}
      onMenuOpened={() => {}}
      onMenuOpenChange={() => {}}
      onMeasure={() => {}}
      onPointerDown={onPointerDown}
      onFocus={() => {}}
      onKeyDown={() => {}}
      canResize={false}
      onResizeStart={() => {}}
      onFit={() => {}}
      onResizeKeyDown={() => {}}
      onResizeKeyUp={() => {}}
      frameChoices={[]}
      structured={false}
      onMoveToFrame={() => {}}
      readOnly={readOnly}
    />,
  );
  const card = utils.getByTestId("lab-card-n1");
  // BI-1b: on the board the work body is not a control; a click selects, a double click opens.
  const body = card.querySelector(".nb-paper-body") as HTMLElement;
  return { ...utils, card, body, onOpen, onPointerDown, onSelect };
}

function press(card: Element, body: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.pointerDown(card, { clientX: from.x, clientY: from.y });
  fireEvent.pointerMove(card, { clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(card, { clientX: to.x, clientY: to.y });
  // A real click targets the innermost element: the card body. The card's
  // capture-phase handler sees it on the way down.
  fireEvent.click(body, { clientX: to.x, clientY: to.y, detail: 1 });
}

afterEach(cleanup);

describe("unit W2 workboard card click after drag", () => {
  it("a drag that ends on the card neither selects nor opens it", () => {
    const { card, body, onOpen, onSelect } = renderCard();
    press(card, body, { x: 100, y: 100 }, { x: 140, y: 140 });
    expect(onOpen).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("a stationary click selects the card and does not open it", () => {
    const { card, body, onOpen, onSelect } = renderCard();
    press(card, body, { x: 100, y: 100 }, { x: 100, y: 100 });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("a wobble inside the threshold still selects, never opens", () => {
    const { card, body, onOpen, onSelect } = renderCard();
    press(card, body, { x: 100, y: 100 }, { x: 102, y: 101 });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("a double click on the content area opens exactly once", () => {
    const { card, body, onOpen } = renderCard();
    press(card, body, { x: 100, y: 100 }, { x: 100, y: 100 });
    fireEvent.doubleClick(body, { clientX: 100, clientY: 100 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("the work body is not a focusable control on the board", () => {
    const { body, onOpen } = renderCard();
    expect(body.hasAttribute("role")).toBe(false);
    expect(body.hasAttribute("tabindex")).toBe(false);
    fireEvent.keyDown(body, { key: "Enter" });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("the Open button opens exactly once without starting a card drag", () => {
    const { getByRole, onOpen, onPointerDown } = renderCard();
    const open = getByRole("button", { name: "Open" });
    fireEvent.pointerDown(open, { clientX: 20, clientY: 20 });
    fireEvent.click(open);
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("the Open button works immediately after a suppressed drag", () => {
    const { card, body, getByRole, onOpen } = renderCard();
    press(card, body, { x: 100, y: 100 }, { x: 140, y: 140 });
    fireEvent.pointerDown(getByRole("button", { name: "Open" }), { clientX: 20, clientY: 20 });
    fireEvent.click(getByRole("button", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows Open on an interactive card and omits it in read-only mode", () => {
    const interactive = renderCard();
    expect(interactive.getByRole("button", { name: "Open" })).toBeTruthy();
    interactive.unmount();
    const readOnly = renderCard({ readOnly: true });
    expect(readOnly.queryByRole("button", { name: "Open" })).toBeNull();
  });

  it("keeps Open and Card options as siblings in one control bar", () => {
    const { getByRole } = renderCard();
    const open = getByRole("button", { name: "Open" });
    const options = getByRole("button", { name: "Card options" });
    expect(open.parentElement).toBe(options.parentElement);
    expect(open.parentElement?.classList.contains("canvas-lab-card-bar")).toBe(true);
  });
});
