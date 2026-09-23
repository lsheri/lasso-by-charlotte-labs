// @vitest-environment jsdom
/**
 * P1b: the board, driven.
 *
 * WHY THIS FILE EXISTS.
 * Six tests read CanvasLabPage.tsx as text and assert code strings, because the
 * wiring they care about sits inline in a very large page and there was no
 * other way to reach it. The maths those strings name (wheelPanVector,
 * zoomAbout, clampZoom, dragTo) is already covered in its own lib tests. What
 * was never covered is the WIRING: that the right primitive runs in the right
 * branch with the right arguments.
 *
 * BoardShell is that wiring with no data dependencies, so here it is rendered
 * and driven with real events. Every test in this file has been shown to fail
 * under a one-line mutation of the shell; a test that cannot go red is not a
 * guard and does not belong here.
 *
 * HONEST LIMITS, stated rather than papered over:
 * - jsdom does not enforce listener passivity, so `defaultPrevented` proves the
 *   handler calls preventDefault on a cancelable wheel, not that the listener
 *   was registered non-passive. The `{ passive: false }` registration stays
 *   asserted as source text in p1-board-shell-lane.test.tsx.
 * - jsdom does not implement `isContentEditable`, so the contenteditable arm of
 *   the typing guard cannot be driven here. Its input/textarea/select siblings
 *   are driven for real.
 * - Layout is stubbed: clientWidth/clientHeight and ResizeObserver do not exist
 *   in jsdom. Both are stubbed to report honest, changing values rather than to
 *   make an assertion pass.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { BoardShell } from "@/components/board/BoardShell";
import { fitWorkboardViewport } from "@/components/canvas-lab/canvas-lab-model";
import { dragTo, keyTo } from "@/lib/canvas-drag";
import { stepZoom, workboardPinchZoom } from "@/lib/canvas-zoom";

// ---- the stubs, and nothing beyond them --------------------------------

const viewport = { width: 1000, height: 800 };
const resizeCallbacks = new Set<() => void>();

class StubResizeObserver {
  constructor(private readonly callback: () => void) {}
  observe() {
    resizeCallbacks.add(this.callback);
    // A real ResizeObserver reports once on observe; the stub does too, or the
    // shell's first genuine resize would look like a size change that is not.
    this.callback();
  }
  disconnect() {
    resizeCallbacks.delete(this.callback);
  }
  unobserve() {
    resizeCallbacks.delete(this.callback);
  }
}

let clientWidthDescriptor: PropertyDescriptor | undefined;
let clientHeightDescriptor: PropertyDescriptor | undefined;

beforeAll(() => {
  clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset["testid"] === "board-shell" ? viewport.width : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset["testid"] === "board-shell" ? viewport.height : 0;
    },
  });
  // jsdom has neither of these; a pointer gesture cannot start without them.
  Element.prototype.setPointerCapture = function setPointerCapture() {};
  Element.prototype.releasePointerCapture = function releasePointerCapture() {};
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
});

afterAll(() => {
  if (clientWidthDescriptor) Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidthDescriptor);
  if (clientHeightDescriptor) Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
  vi.unstubAllGlobals();
});

beforeEach(() => {
  viewport.width = 1000;
  viewport.height = 800;
});

afterEach(() => {
  cleanup();
  resizeCallbacks.clear();
});

// ---- the board under test ----------------------------------------------

const NODES = [
  { id: "n1", x: 100, y: 100, width: 220, height: 180, frame: null },
  { id: "n2", x: 400, y: 320, width: 220, height: 180, frame: null },
];

type View = { pan: { x: number; y: number }; zoom: number };

function view(): View {
  const stage = screen.getByTestId("board-shell-stage") as HTMLElement;
  const match = stage.style.transform.match(
    /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\((-?[\d.]+)\)/,
  );
  if (!match) throw new Error(`unreadable transform: ${stage.style.transform}`);
  return { pan: { x: Number(match[1]), y: Number(match[2]) }, zoom: Number(match[3]) };
}

/** The world point currently sitting under a viewport pixel. */
function worldUnder(point: { x: number; y: number }): { x: number; y: number } {
  const { pan, zoom } = view();
  return { x: (point.x - pan.x) / zoom, y: (point.y - pan.y) / zoom };
}

function shell(): HTMLElement {
  return screen.getByTestId("board-shell");
}

function mount(props: Partial<React.ComponentProps<typeof BoardShell>> = {}) {
  return render(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <BoardShell {...({ frames: [], nodes: NODES, renderNode: (node: any) => <span>{node.id}</span>, ...props } as any)} />,
  );
}

function wheel(init: WheelEventInit): WheelEvent {
  const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: 0, deltaY: 0, ...init });
  act(() => {
    shell().dispatchEvent(event);
  });
  return event;
}

function touchPinch(from: number, to: number) {
  const surface = shell().querySelector(".canvas-lab-surface") as HTMLElement;
  fireEvent.pointerDown(surface, { button: 0, pointerId: 11, pointerType: "touch", clientX: 400, clientY: 400 });
  fireEvent.pointerDown(surface, { button: 0, pointerId: 12, pointerType: "touch", clientX: 400 + from, clientY: 400 });
  fireEvent.pointerMove(surface, { pointerId: 12, pointerType: "touch", clientX: 400 + to, clientY: 400 });
  fireEvent.pointerUp(surface, { pointerId: 12, pointerType: "touch", clientX: 400 + to, clientY: 400 });
  fireEvent.pointerUp(surface, { pointerId: 11, pointerType: "touch", clientX: 400, clientY: 400 });
}

// ---- the wheel -----------------------------------------------------------

describe("the wheel", () => {
  it("pans, opposite the delta", () => {
    mount();
    const before = view();
    wheel({ deltaY: 120, deltaX: 40 });
    const after = view();
    expect(after.pan).toEqual({ x: before.pan.x - 40, y: before.pan.y - 120 });
    expect(after.zoom).toBe(before.zoom);
  });

  it("zooms about the cursor: the point under the pointer stays put", () => {
    mount();
    const cursor = { x: 640, y: 420 };
    const before = view();
    const held = worldUnder(cursor);
    wheel({ deltaY: -240, ctrlKey: true, clientX: cursor.x, clientY: cursor.y });
    const after = view();
    expect(after.zoom).toBeCloseTo(workboardPinchZoom(before.zoom, -240, 0), 10);
    expect(after.zoom).not.toBeCloseTo(before.zoom, 3);
    const stillThere = worldUnder(cursor);
    expect(stillThere.x).toBeCloseTo(held.x, 6);
    expect(stillThere.y).toBeCloseTo(held.y, 6);
  });

  it("cancels the page's own scroll when it takes the gesture", () => {
    mount();
    expect(wheel({ deltaY: 90 }).defaultPrevented).toBe(true);
    expect(wheel({ deltaY: 90, ctrlKey: true, clientX: 10, clientY: 10 }).defaultPrevented).toBe(true);
  });
});

// ---- the pointer ---------------------------------------------------------

describe("the pointer", () => {
  it("drags a board node by the delta divided by the zoom, so it tracks the cursor", () => {
    const onNodeMove = vi.fn();
    mount({ onNodeMove });
    // Zoom away from 1 first, or dividing by the zoom would be invisible.
    wheel({ deltaY: -240, ctrlKey: true, clientX: 500, clientY: 400 });
    const { zoom } = view();
    expect(zoom).not.toBe(1);

    const node = document.querySelector('[data-board-node="n1"]') as HTMLElement;
    fireEvent.pointerDown(node, { button: 0, pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(node, { pointerId: 1, clientX: 420, clientY: 530 });
    fireEvent.pointerUp(node, { pointerId: 1 });

    expect(onNodeMove).toHaveBeenCalledWith("n1", dragTo({ x: 100, y: 100 }, { x: 220 / zoom, y: 330 / zoom }));
  });

  it("pans instead of dragging while space is held", () => {
    const onNodeMove = vi.fn();
    mount({ onNodeMove });
    const before = view();
    fireEvent.keyDown(window, { code: "Space", key: " " });
    const node = document.querySelector('[data-board-node="n1"]') as HTMLElement;
    fireEvent.pointerDown(node, { button: 0, pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(node, { pointerId: 1, clientX: 260, clientY: 250 });
    fireEvent.pointerUp(node, { pointerId: 1 });
    fireEvent.keyUp(window, { code: "Space", key: " " });

    expect(onNodeMove).not.toHaveBeenCalled();
    expect(view().pan).toEqual({ x: before.pan.x + 60, y: before.pan.y + 50 });
  });
});

// ---- the keyboard --------------------------------------------------------

describe("the keyboard", () => {
  it("nudges the selected node, and shift takes the longer step", () => {
    const onNodeMove = vi.fn();
    mount({ onNodeMove, selectedIds: ["n1"] });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onNodeMove).toHaveBeenLastCalledWith("n1", keyTo({ x: 100, y: 100 }, "ArrowRight", false));
    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
    const coarse = keyTo({ x: 100, y: 100 }, "ArrowRight", true);
    expect(onNodeMove).toHaveBeenLastCalledWith("n1", coarse);
    expect(coarse).not.toEqual(keyTo({ x: 100, y: 100 }, "ArrowRight", false));
  });

  it("stays out of the way while someone is typing", () => {
    const onNodeMove = vi.fn();
    mount({
      onNodeMove,
      selectedIds: ["n1"],
      toolbar: (
        <>
          <input aria-label="text field" />
          <textarea aria-label="long field" />
          <select aria-label="choice">
            <option>one</option>
          </select>
        </>
      ),
    });
    for (const label of ["text field", "long field", "choice"]) {
      const field = screen.getByLabelText(label) as HTMLElement;
      field.focus();
      fireEvent.keyDown(field, { key: "ArrowRight", bubbles: true });
      expect(onNodeMove).not.toHaveBeenCalled();
      field.blur();
    }
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onNodeMove).toHaveBeenCalledTimes(1);
  });

  it("zooms about the centre on cmd 0, cmd plus and cmd minus", () => {
    mount();
    const centre = { x: viewport.width / 2, y: viewport.height / 2 };

    const start = view();
    const heldIn = worldUnder(centre);
    fireEvent.keyDown(window, { key: "=", metaKey: true });
    const zoomedIn = view();
    expect(zoomedIn.zoom).toBeCloseTo(stepZoom(start.zoom, "in"), 10);
    expect(worldUnder(centre).x).toBeCloseTo(heldIn.x, 6);
    expect(worldUnder(centre).y).toBeCloseTo(heldIn.y, 6);

    fireEvent.keyDown(window, { key: "-", ctrlKey: true });
    expect(view().zoom).toBeCloseTo(stepZoom(zoomedIn.zoom, "out"), 10);

    fireEvent.keyDown(window, { key: "0", metaKey: true });
    expect(view().zoom).toBe(1);
  });

  it("clears the selection on Escape", () => {
    const onSelectNode = vi.fn();
    mount({ onSelectNode, selectedIds: ["n1"] });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onSelectNode).toHaveBeenCalledWith(null);
  });
});

describe("an opt-in zoom lock", () => {
  it("holds wheel, touch pinch and keyboard zoom at one while an ordinary board still responds", () => {
    const locked = mount({ lockZoom: true });
    wheel({ deltaY: -120, ctrlKey: true, clientX: 500, clientY: 400 });
    touchPinch(100, 150);
    fireEvent.keyDown(window, { key: "=", metaKey: true });
    expect(view().zoom).toBe(1);
    locked.unmount();

    mount();
    wheel({ deltaY: -120, ctrlKey: true, clientX: 500, clientY: 400 });
    const afterWheel = view().zoom;
    expect(afterWheel).toBeGreaterThan(1);
    fireEvent.keyDown(window, { key: "-", ctrlKey: true });
    const afterKeyboard = view().zoom;
    expect(afterKeyboard).toBeLessThan(afterWheel);
    touchPinch(100, 150);
    expect(view().zoom).toBeGreaterThan(afterKeyboard);
  });

  it("shows Fit without zoom controls only when requested", () => {
    const locked = mount({ showViewControls: true, showZoomControls: false, lockZoom: true });
    expect(screen.getByRole("button", { name: "Fit" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Board zoom" })).toBeNull();
    locked.unmount();

    mount({ showViewControls: true });
    expect(screen.getByRole("button", { name: "Fit" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Board zoom" })).toBeTruthy();
  });
});

// ---- the fit -------------------------------------------------------------

describe("the fit", () => {
  const expected = (size: { width: number; height: number }) =>
    fitWorkboardViewport(size, [], [...NODES], new Map(), null);

  it("runs on mount, against the shell's own viewport", () => {
    // With no ResizeObserver at all, the mount fit is the only path left, so
    // this cannot pass on the back of the observer's first report.
    vi.stubGlobal("ResizeObserver", undefined);
    mount();
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    const wanted = expected({ width: 1000, height: 800 });
    const got = view();
    expect(got.zoom).toBeCloseTo(wanted.zoom, 10);
    expect(got.pan.x).toBeCloseTo(wanted.pan.x, 6);
    expect(got.pan.y).toBeCloseTo(wanted.pan.y, 6);
  });

  it("runs again when the viewport really changes, and not when it reports the same size", async () => {
    mount();
    // Move the view by hand, so a refit is visible as the view snapping back.
    wheel({ deltaY: 200, deltaX: 150 });
    const moved = view();
    expect(moved.pan).not.toEqual(expected({ width: 1000, height: 800 }).pan);

    act(() => {
      for (const callback of resizeCallbacks) callback();
    });
    expect(view().pan).toEqual(moved.pan);

    viewport.width = 620;
    viewport.height = 500;
    act(() => {
      for (const callback of resizeCallbacks) callback();
    });
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    const wanted = expected({ width: 620, height: 500 });
    expect(view().zoom).toBeCloseTo(wanted.zoom, 10);
    expect(view().pan.x).toBeCloseTo(wanted.pan.x, 6);
    expect(view().pan.y).toBeCloseTo(wanted.pan.y, 6);
  });
});

// ---- the fit does not run on content identity ----------------------------

describe("a hand-moved board", () => {
  it("keeps its pan through an ordinary re-render after a size change", async () => {
    // The size change first: it is what arms the refit path at all.
    const { rerender } = mount();
    viewport.width = 860;
    viewport.height = 700;
    act(() => {
      for (const callback of resizeCallbacks) callback();
    });
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    // Move the view by hand, so a refit would be visible as a snap back.
    wheel({ deltaY: 180, deltaX: 120 });
    const moved = view();

    // An ordinary re-render: same content, fresh array identities, same size.
    act(() => {
      rerender(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <BoardShell {...({ frames: [], nodes: NODES.map((node) => ({ ...node })), renderNode: (node: any) => <span>{node.id}</span> } as any)} />,
      );
    });

    expect(view().pan).toEqual(moved.pan);
    expect(view().zoom).toBe(moved.zoom);
  });
});
