// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { LabCard } from "@/components/canvas-lab/LabCard";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

const focused: LabNode = { id: "focused", kind: "judgment", frame: "f", title: "Focused card", summary: "Reason", typeLabel: "judgment", ownership: "draft", local: true, x: 0, y: 0, width: 232, height: 112 };
const contextual: LabNode = { ...focused, id: "context", title: "Context card", x: 260 };

function card(node: LabNode, selected: boolean, isFocused: boolean, onSelect = () => undefined) {
  return <LabCard node={node} selected={selected} focused={isFocused} connecting={false} connectSourceAnchor={null} canResize onSelect={onSelect} onOpen={() => undefined} onBranch={() => undefined} onHide={() => undefined} onDelete={() => undefined} onEdit={() => undefined} onEditCommitted={() => undefined} onAnchorPointerDown={() => undefined} onAnchorActivate={() => undefined} onMenuOpened={() => undefined} onMenuOpenChange={() => undefined} onMeasure={() => undefined} onPointerDown={() => undefined} onFocus={() => undefined} onKeyDown={() => undefined} onResizeStart={() => undefined} onFit={() => undefined} onResizeKeyDown={() => undefined} onResizeKeyUp={() => undefined} frameChoices={[]} structured onMoveToFrame={() => undefined} />;
}

function PointerContextHarness() {
  const [selected, setSelected] = useState(false);
  return <><output aria-label="Context count">{selected ? 1 : 0}</output>{card(focused, selected, true, () => setSelected((value) => !value))}</>;
}

afterEach(cleanup);

describe("Workboard click, selection, and handles", () => {
  it("shows resize handles only on the focused card, not an in-context card", () => {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as typeof ResizeObserver;
    render(<>{card(focused, false, true)}{card(contextual, true, false)}</>);
    const focusedRoot = screen.getByRole("group", { name: "Focused card" });
    const contextRoot = screen.getByRole("group", { name: "Context card, in context" });
    expect(focusedRoot.querySelectorAll(".canvas-lab-resize-handle")).toHaveLength(4);
    expect(contextRoot.querySelector(".canvas-lab-card-paper")?.getAttribute("data-selected")).toBe("true");
    expect(contextRoot.querySelectorAll(".canvas-lab-resize-handle")).toHaveLength(0);
    expect(contextRoot.hasAttribute("aria-pressed")).toBe(false);
    expect(contextRoot.getAttribute("aria-roledescription")).toBe("card");
  });

  it("never toggles context from a pointer click on the card", () => {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as typeof ResizeObserver;
    render(<PointerContextHarness />);
    const root = screen.getByRole("group", { name: "Focused card" });
    fireEvent.pointerDown(root, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(root, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.click(root);
    expect(screen.getByLabelText("Context count").textContent).toBe("0");
  });
});