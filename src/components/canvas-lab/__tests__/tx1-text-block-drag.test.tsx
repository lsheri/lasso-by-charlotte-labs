// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabTextBlock } from "@/components/canvas-lab/LabTextBlock";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import type { WorkboardTextBody } from "@/lib/canvas-lab-shared";

afterEach(cleanup);

const baseNode = (summary = "Hello"): LabNode => ({
  id: "t1", clientKey: "t1", kind: "text", frame: null, title: "Text block", summary, typeLabel: "text block",
  ownership: "yours", textSize: "label", textWeight: "medium", textColour: "ink", local: true,
  x: 0, y: 0, width: 260, height: 80,
} as LabNode);

function Harness({ initialSelected = false, readOnly = false, summary = "Hello", onDragStart, onBoardPress }: {
  initialSelected?: boolean; readOnly?: boolean; summary?: string;
  onDragStart: (event: unknown) => void; onBoardPress?: (empty: boolean) => void;
}) {
  const [selected, setSelected] = useState(initialSelected);
  const [node, setNode] = useState(baseNode(summary));
  return (
    <div data-testid="board" onPointerDown={(event) => onBoardPress?.(event.target === event.currentTarget)}>
      <LabTextBlock node={node} selected={selected} editable={!readOnly} layoutEditable={!readOnly}
        onSelect={() => { if (!readOnly) setSelected(true); }} onDragStart={onDragStart}
        onResizeStart={vi.fn()} onResizeKeyDown={vi.fn()} onResizeKeyUp={vi.fn()}
        onChange={(body: WorkboardTextBody) => setNode((n) => ({ ...n, summary: body.text }))} onCommit={vi.fn()} onRemove={vi.fn()} />
    </div>
  );
}

const section = () => screen.getByTestId("text-block-t1");
const words = () => screen.getByLabelText("Text block words") as HTMLTextAreaElement;

describe("TX1 text block body drag", () => {
  it("a press on an unselected body starts the drag and is not an empty-board press", () => {
    const drag = vi.fn();
    const board = vi.fn();
    render(<Harness onDragStart={drag} onBoardPress={board} />);
    expect(section().style.pointerEvents).toBe("auto");
    expect(words().style.pointerEvents).toBe("none");
    fireEvent.pointerDown(section(), { button: 0 });
    expect(drag).toHaveBeenCalledTimes(1);
    expect(board).toHaveBeenCalledWith(false);
    expect(section().dataset["selected"]).toBe("true");
  });

  it("double click enters edit mode and focuses the words; a body press then starts no drag", () => {
    const drag = vi.fn();
    render(<Harness initialSelected onDragStart={drag} />);
    fireEvent.doubleClick(section());
    expect(section().dataset["editing"]).toBe("true");
    expect(document.activeElement).toBe(words());
    expect(words().readOnly).toBe(false);
    fireEvent.pointerDown(section(), { button: 0 });
    fireEvent.pointerDown(words(), { button: 0 });
    expect(drag).not.toHaveBeenCalled();
  });

  it("Enter on a selected block enters edit mode", () => {
    render(<Harness initialSelected onDragStart={vi.fn()} />);
    fireEvent.keyDown(section(), { key: "Enter" });
    expect(section().dataset["editing"]).toBe("true");
  });

  it("Escape leaves edit mode, keeps the block selected, and keeps the typed words", () => {
    render(<Harness initialSelected onDragStart={vi.fn()} />);
    fireEvent.doubleClick(section());
    fireEvent.change(words(), { target: { value: "Typed words" } });
    fireEvent.keyDown(words(), { key: "Escape" });
    expect(section().dataset["editing"]).toBe("false");
    expect(section().dataset["selected"]).toBe("true");
    expect(words().value).toBe("Typed words");
    fireEvent.doubleClick(section());
    expect(words().value).toBe("Typed words");
  });

  it("a press outside the block leaves edit mode", () => {
    render(<Harness initialSelected onDragStart={vi.fn()} />);
    fireEvent.doubleClick(section());
    act(() => { document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    expect(section().dataset["editing"]).toBe("false");
  });

  it("a new empty selected block opens in edit mode and focused", () => {
    render(<Harness initialSelected summary="" onDragStart={vi.fn()} />);
    expect(section().dataset["editing"]).toBe("true");
    expect(document.activeElement).toBe(words());
  });

  it("on a read-only board a body press starts no drag and no edit", () => {
    const drag = vi.fn();
    render(<Harness readOnly onDragStart={drag} />);
    expect(section().style.pointerEvents).toBe("none");
    fireEvent.pointerDown(section(), { button: 0 });
    fireEvent.doubleClick(section());
    expect(drag).not.toHaveBeenCalled();
    expect(section().dataset["editing"]).toBe("false");
    expect(words().readOnly).toBe(true);
  });

  it("edge strips start a drag both when not editing and while editing", () => {
    const drag = vi.fn();
    render(<Harness initialSelected onDragStart={drag} />);
    fireEvent.pointerDown(screen.getByLabelText("Move text block from top edge"), { button: 0 });
    expect(drag).toHaveBeenCalledTimes(1);
    fireEvent.doubleClick(section());
    fireEvent.pointerDown(screen.getByLabelText("Move text block from left edge"), { button: 0 });
    expect(drag).toHaveBeenCalledTimes(2);
  });

  it("the shared board stylesheet still neutralises the strips", () => {
    const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");
    expect(css).toMatch(/\.shared-board-stage \.canvas-lab-text-block-edge/);
  });
});
