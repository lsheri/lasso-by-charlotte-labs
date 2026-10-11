// @vitest-environment jsdom
/** BB-2: a press inside a portal rendered in BoardShell's tree is not a pan. */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { BoardShell } from "@/components/board/BoardShell";

beforeAll(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

function setup() {
  const capture = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: capture });
  render(
    <BoardShell
      frames={[]}
      nodes={[{ id: "n1", frame: "", x: 0, y: 0, width: 100, height: 50 } as never]}
      renderNode={() => <div>card{createPortal(<button>Delete piece</button>, document.body)}</div>}
      ariaLabel="Test board"
    />,
  );
  return capture;
}

describe("BB-2 portalled presses", () => {
  it("a press on a portalled menu item does not capture the pointer", () => {
    const capture = setup();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Delete piece" }), { button: 0, pointerId: 1 });
    expect(capture).not.toHaveBeenCalled();
  });

  it("a press on the board surface still captures for a pan", () => {
    const capture = setup();
    const surface = document.querySelector(".canvas-lab-surface")!;
    fireEvent.pointerDown(surface, { button: 0, pointerId: 1 });
    expect(capture).toHaveBeenCalled();
  });
});
