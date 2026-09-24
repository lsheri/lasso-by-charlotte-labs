import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LabCard } from "../LabCard";

const props = {
  node: { id: "n", kind: "judgment" as const, frame: "f", title: "Judgment", summary: "Reason", typeLabel: "judgment", ownership: "draft" as const, local: true, x: 0, y: 0, width: 232, height: 112 },
  selected: true,
  focused: false,
  connecting: false,
  connectSourceAnchor: null,
  canResize: false,
  onSelect: () => undefined,
  onOpen: () => undefined,
  onBranch: () => undefined,
  onHide: () => undefined,
  onDelete: () => undefined,
  onEdit: () => undefined,
  onEditCommitted: () => undefined,
  onAnchorPointerDown: () => undefined,
  onAnchorActivate: () => undefined,
  onMenuOpened: () => undefined,
  onMenuOpenChange: () => undefined,
  onMeasure: () => undefined,
  onPointerDown: () => undefined,
  onFocus: () => undefined,
  onKeyDown: () => undefined,
  onResizeStart: () => undefined,
  onFit: () => undefined,
  onResizeKeyDown: () => undefined,
  onResizeKeyUp: () => undefined,
  frameChoices: [],
  structured: true,
  onMoveToFrame: () => undefined,
};

describe("C1.1 context flare overlay", () => {
  it("exists only while a context flare delay is present", () => {
    const card = render(<LabCard {...props} />);
    expect(card.container.querySelector(".canvas-lab-flare")).toBeNull();
    expect(card.container.querySelector(".canvas-lab-flare-bloom")).toBeNull();

    card.rerender(<LabCard {...props} contextFlareDelay={45} contextMotionClass="canvas-lab-context-flare" />);
    expect(card.container.querySelector(".canvas-lab-flare-beam")).not.toBeNull();
    expect(card.container.querySelector(".canvas-lab-flare-bloom")).not.toBeNull();
  });
});