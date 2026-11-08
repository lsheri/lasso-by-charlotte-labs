// @vitest-environment jsdom
// DRAG-1: workstreams and sections move with everything in them.
// Name strip any time; anywhere inside once selected; unselected inside never starts a move.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabFrame } from "@/components/canvas-lab/LabFrame";
import type { LabFrame as LabFrameModel } from "@/components/canvas-lab/canvas-lab-model";
import { sectionDragSnapshot } from "@/lib/board-section";

const model: LabFrameModel = { id: "region:abc", name: "Pricing", x: 0, y: 0, width: 400, height: 300 };

function renderFrame(selected: boolean, onSelect = vi.fn(), onDragStart = vi.fn()) {
  const view = render(
    <LabFrame frame={model} count={0} selected={selected} editable custom namedByWorkstream={false} removable kind="custom" region
      onSelect={onSelect} onDragStart={onDragStart} onResizeStart={vi.fn()} onFit={vi.fn()} onRename={vi.fn()} onRemove={vi.fn()} onMenuOpened={vi.fn()} onMenuOpenChange={vi.fn()} />,
  );
  return { view, onSelect, onDragStart, root: view.getByTestId("lab-frame-region:abc") };
}

describe("DRAG-1 frames move with their contents", () => {
  afterEach(cleanup);

  it("an unselected workstream: a press inside selects it but does not move it", () => {
    const { root, onSelect, onDragStart } = renderFrame(false);
    fireEvent.pointerDown(root, { button: 0 });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it("the name strip moves it any time", () => {
    const { root, onDragStart } = renderFrame(false);
    fireEvent.pointerDown(root.querySelector("[data-frame-name] h2") as Element, { button: 0 });
    expect(onDragStart).toHaveBeenCalledOnce();
  });

  it("a selected workstream moves from anywhere inside", () => {
    const { root, onDragStart } = renderFrame(true);
    expect(root.getAttribute("data-movable")).toBe("true");
    fireEvent.pointerDown(root, { button: 0 });
    expect(onDragStart).toHaveBeenCalledOnce();
  });

  it("workstreams made from a list (task) and custom ones can move, not only drawn ones", () => {
    const page = readFileSync(resolve(process.cwd(), "src/pages/CanvasLabPage.tsx"), "utf8");
    expect(page).toContain('onDragStart={(region || kind === "task" || kind === "custom") && boardEditable ? (event) => startGroupingDrag(frame');
  });

  it("a click inside a section on the board selects it, so the next press inside moves it", () => {
    const page = readFileSync(resolve(process.cwd(), "src/pages/CanvasLabPage.tsx"), "utf8");
    const click = page.slice(page.indexOf("if (isMarqueeClick(marqueeRect(box.fromScreen, toScreen)))"), page.indexOf("const ids = cardsInMarquee("));
    expect(click).toContain("containingSection(box.fromBoard");
    expect(click).toContain("setSelectedFrameId(section.id)");
  });

  it("a video inside a section moves with it, like any other card", () => {
    const snapshot = sectionDragSnapshot(
      { x: 0, y: 0, width: 600, height: 400 },
      [],
      [{ id: "v1", kind: "video", frame: null, x: 100, y: 100, width: 320, height: 200 } as never, { id: "c1", frame: null, x: 300, y: 50, width: 240, height: 108 } as never],
    );
    expect(snapshot.cards.map((card) => card.id).sort()).toEqual(["c1", "v1"]);
  });

  it("a selected section takes presses inside it; unselected, its inside stays the board", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    expect(css).toContain('.canvas-lab-section[data-selected="true"][data-movable="true"] { pointer-events: auto; cursor: grab; }');
    expect(css).toMatch(/\.canvas-lab-section \{ position: absolute; pointer-events: none;/);
  });
});
