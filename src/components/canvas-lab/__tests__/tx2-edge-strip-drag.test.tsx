// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabColourBlock } from "@/components/canvas-lab/LabColourBlock";
import { LabSticky } from "@/components/canvas-lab/LabSticky";
import { LabTextBlock } from "@/components/canvas-lab/LabTextBlock";
import { cardPressStartsDrag, type LabNode } from "@/components/canvas-lab/canvas-lab-model";

const logEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ logEvent }));
import { noteWorkboardNodeMoved } from "@/components/canvas-lab/canvas-lab-telemetry";
import { guardWorkboardEvent } from "@/lib/workboard-event-allowlist";

afterEach(cleanup);

const node = (kind: LabNode["kind"], id = "n1"): LabNode => ({
  id, clientKey: id, kind, frame: null, title: kind, summary: "Hello", typeLabel: kind,
  ownership: "yours", textSize: "label", textWeight: "medium", textColour: "ink", local: true,
  x: 0, y: 0, width: 260, height: 80,
} as LabNode);

function press(target: EventTarget | null, button = 0) {
  return cardPressStartsDrag({ button, target });
}

describe("TX2 cardPressStartsDrag guard", () => {
  it("a press on an element carrying data-edge reaches the drag start, even when it is a button", () => {
    const strip = document.createElement("button");
    strip.setAttribute("data-edge", "top");
    expect(press(strip)).toBe(true);
    const span = document.createElement("span");
    span.setAttribute("data-edge", "left");
    expect(press(span)).toBe(true);
  });

  it("a resize corner button does not reach the drag start", () => {
    const corner = document.createElement("button");
    corner.setAttribute("data-corner", "nw");
    expect(press(corner)).toBe(false);
  });

  it("a card menu button does not reach the drag start", () => {
    const menu = document.createElement("button");
    menu.setAttribute("aria-label", "Card menu");
    expect(press(menu)).toBe(false);
  });

  it("a press inside a text box does not reach the drag start", () => {
    const area = document.createElement("textarea");
    expect(press(area)).toBe(false);
    // A child of a text box is still inside it.
    const wrap = document.createElement("div");
    wrap.appendChild(area);
    expect(press(area)).toBe(false);
  });

  it("a non-left press never starts a drag, even on an edge strip", () => {
    const strip = document.createElement("button");
    strip.setAttribute("data-edge", "top");
    expect(press(strip, 2)).toBe(false);
  });
});

describe("TX2 data-edge inventory on the three blocks", () => {
  const stripProps = {
    onSelect: vi.fn(), onDragStart: vi.fn(), onResizeStart: vi.fn(),
    onResizeKeyDown: vi.fn(), onResizeKeyUp: vi.fn(), onRemove: vi.fn(),
  };

  it("the text block's four strips are buttons carrying data-edge", () => {
    render(<LabTextBlock node={node("text")} selected editable layoutEditable {...stripProps}
      onChange={vi.fn()} onCommit={vi.fn()} />);
    const strips = screen.getByTestId("text-block-n1").querySelectorAll("[data-edge]");
    expect(strips).toHaveLength(4);
    strips.forEach((strip) => expect(strip.tagName).toBe("BUTTON"));
  });

  it("the colour block's four strips are buttons carrying data-edge", () => {
    render(<LabColourBlock node={node("shape")} selected editable {...stripProps} />);
    const strips = screen.getByTestId("colour-block-n1").querySelectorAll("[data-edge]");
    expect(strips).toHaveLength(4);
    strips.forEach((strip) => expect(strip.tagName).toBe("BUTTON"));
  });

  it("the sticky's four strips are spans carrying data-edge, so the button guard never touched them", () => {
    render(<LabSticky node={node("sticky")} selected editable layoutEditable {...stripProps}
      onChange={vi.fn()} onCommit={vi.fn()} />);
    const strips = screen.getByTestId("sticky-n1").querySelectorAll("[data-edge]");
    expect(strips).toHaveLength(4);
    strips.forEach((strip) => expect(strip.tagName).toBe("SPAN"));
  });

  it("nothing else in src carries data-edge", () => {
    const source = ["src/components/canvas-lab/LabTextBlock.tsx", "src/components/canvas-lab/LabColourBlock.tsx", "src/components/canvas-lab/LabSticky.tsx"]
      .map((path) => readFileSync(`${process.cwd()}/${path}`, "utf8"));
    source.forEach((text) => expect(text).toContain("data-edge"));
  });
});

describe("TX2 shared board", () => {
  it("the shared board stylesheet still hides the text and colour block strips", () => {
    const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");
    expect(css).toMatch(/\.shared-board-stage \.canvas-lab-text-block-edge/);
    expect(css).toMatch(/\.shared-board-stage \.canvas-lab-colour-block-edge/);
  });
});

describe("DRAG-1 read-only faces", () => {
  it("a readOnly textarea starts a drag", () => {
    const area = document.createElement("textarea");
    area.readOnly = true;
    expect(press(area)).toBe(true);
  });

  it("a writable textarea does not start a drag", () => {
    expect(press(document.createElement("textarea"))).toBe(false);
  });

  it("a press on the read-only text block words starts its drag, and double click still edits", () => {
    const onDragStart = vi.fn();
    const noop = () => {};
    const { container } = render(<LabTextBlock node={node("text")} selected={false} editable layoutEditable onSelect={noop} onDragStart={onDragStart} onResizeStart={noop} onResizeKeyDown={noop} onResizeKeyUp={noop} onChange={noop} onCommit={noop} onRemove={noop} />);
    const words = screen.getByLabelText("Text block words");
    fireEvent.pointerDown(words, { button: 0 });
    expect(onDragStart).toHaveBeenCalledTimes(1);
    fireEvent.doubleClick(words);
    expect(container.querySelector("section")!.getAttribute("data-editing")).toBe("true");
  });

  it("workboard.node_moved carries kind and via only", () => {
    logEvent.mockClear();
    noteWorkboardNodeMoved("org-1", "sticky", "body");
    noteWorkboardNodeMoved("org-1", "text", "edge");
    noteWorkboardNodeMoved("org-1", "sticky", "keyboard");
    expect(logEvent.mock.calls).toEqual([
      ["workboard.node_moved", "org-1", { kind: "sticky", via: "body" }],
      ["workboard.node_moved", "org-1", { kind: "text", via: "edge" }],
      ["workboard.node_moved", "org-1", { kind: "sticky", via: "keyboard" }],
    ]);
    expect(guardWorkboardEvent("workboard.node_moved", { kind: "sticky", via: "edge" })).toEqual({ keep: true, dims: { kind: "sticky", via: "edge" } });
  });
});
