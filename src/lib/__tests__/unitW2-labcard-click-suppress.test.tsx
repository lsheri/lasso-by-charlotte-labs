// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabCard } from "@/components/canvas-lab/LabCard";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import type { WorkItemRow } from "@/lib/work-types";

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
};

function renderCard(onOpen = vi.fn()) {
  const utils = render(
    <LabCard
      node={node}
      item={item}
      selected={false}
      focused={false}
      onSelect={() => {}}
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
      onPointerDown={() => {}}
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
    />,
  );
  const card = utils.getByTestId("lab-card-n1");
  const body = utils.getByRole("button", { name: "A piece of work" });
  return { ...utils, card, body, onOpen };
}

function press(card: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.pointerDown(card, { clientX: from.x, clientY: from.y });
  fireEvent.pointerMove(card, { clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(card, { clientX: to.x, clientY: to.y });
  fireEvent.click(card, { clientX: to.x, clientY: to.y });
}

afterEach(cleanup);

describe("unit W2 workboard card click after drag", () => {
  it("a drag that ends on the card does not open it", () => {
    const { card, onOpen } = renderCard();
    press(card, { x: 100, y: 100 }, { x: 140, y: 140 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("a stationary click opens the card", () => {
    const { card, onOpen } = renderCard();
    press(card, { x: 100, y: 100 }, { x: 100, y: 100 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("a wobble inside the threshold still opens the card", () => {
    const { card, onOpen } = renderCard();
    press(card, { x: 100, y: 100 }, { x: 102, y: 101 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("suppression lasts one gesture: the next real click opens", () => {
    const { card, onOpen } = renderCard();
    press(card, { x: 100, y: 100 }, { x: 160, y: 160 });
    expect(onOpen).not.toHaveBeenCalled();
    press(card, { x: 100, y: 100 }, { x: 100, y: 100 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("Enter on the card body opens it, no pointer involved", () => {
    const { body, onOpen } = renderCard();
    fireEvent.keyDown(body, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
