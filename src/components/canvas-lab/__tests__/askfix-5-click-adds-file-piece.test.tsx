// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));

import { LabCard } from "@/components/canvas-lab/LabCard";

if (!(globalThis as { ResizeObserver?: unknown }).ResizeObserver) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderCard(onSelect: (via?: string) => void, onPointerDown: () => void = () => undefined) {
  return render(
    <LabCard
      node={{
        id: "n",
        kind: "judgment",
        frame: "f",
        title: "Judgment",
        summary: "Reason",
        typeLabel: "judgment",
        ownership: "draft",
        local: true,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      }}
      selected={false}
      focused={false}
      connecting={false}
      connectSourceAnchor={null}
      canResize={false}
      onSelect={onSelect}
      onOpen={() => undefined}
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
      onPointerDown={onPointerDown}
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

/** Stand-in for ReferenceFileCard's body: it stops presses from bubbling to the card. */
function bodyThatSwallowsPresses(container: HTMLElement): HTMLElement {
  const card = container.querySelector<HTMLElement>("[aria-roledescription=card]")!;
  const body = document.createElement("div");
  card.appendChild(body);
  body.addEventListener("pointerdown", (event) => event.stopPropagation());
  return body;
}

describe("ASK-FIX-5 a clean click adds a file piece to Ask", () => {
  it("a press swallowed by the piece's body still counts, so the click selects", () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();
    const onPointerDown = vi.fn();
    const { container } = renderCard(onSelect, onPointerDown);
    const body = bodyThatSwallowsPresses(container);
    fireEvent.pointerDown(body, { button: 0, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(body, { button: 0, clientX: 40, clientY: 40 });
    fireEvent.click(body, { detail: 1, clientX: 40, clientY: 40 });
    expect(onSelect).toHaveBeenCalledWith("card-click");
    // The body still never arms a board drag: the page's press handler did not run.
    expect(onPointerDown).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSelect).toHaveBeenCalledWith("card-confirm");
  });
  it("a press that moved (a text selection or a drag) does not select", () => {
    const onSelect = vi.fn();
    const { container } = renderCard(onSelect);
    const body = bodyThatSwallowsPresses(container);
    fireEvent.pointerDown(body, { button: 0, clientX: 40, clientY: 40 });
    fireEvent.click(body, { detail: 1, clientX: 90, clientY: 40 });
    expect(onSelect).not.toHaveBeenCalled();
  });
  it("buttons inside the piece keep their own click", () => {
    const onSelect = vi.fn();
    const { container } = renderCard(onSelect);
    const body = bodyThatSwallowsPresses(container);
    const button = document.createElement("button");
    body.appendChild(button);
    fireEvent.pointerDown(button, { button: 0, clientX: 40, clientY: 40 });
    fireEvent.click(button, { detail: 1, clientX: 40, clientY: 40 });
    expect(onSelect).not.toHaveBeenCalled();
  });
  it("an ordinary card body click is unchanged", () => {
    const onSelect = vi.fn();
    const { container } = renderCard(onSelect);
    const card = container.querySelector<HTMLElement>("[aria-roledescription=card]")!;
    fireEvent.pointerDown(card, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(card, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.click(card, { detail: 1, clientX: 10, clientY: 10 });
    expect(onSelect).toHaveBeenCalledWith("card-click");
  });
});

describe("ASK-FIX-5 scope", () => {
  it("the file card still keeps body presses from arming a drag (P1b unchanged)", () => {
    const source = readFileSync("src/components/canvas-lab/ReferenceFileCard.tsx", "utf8");
    expect(source).toContain('closest("[data-reference-drag-strip]")');
  });
  it("the capture handler only notes the press; it never starts a drag or selects", () => {
    const source = readFileSync("src/components/canvas-lab/LabCard.tsx", "utf8");
    const fn = source.slice(
      source.indexOf("function handleCardPointerDownCapture"),
      source.indexOf("function handleCardPointerUp"),
    );
    expect(fn).toMatch(/clickDownRef\.current = \{ x: event\.clientX, y: event\.clientY \};/);
    expect(fn).not.toMatch(/onPointerDown\(|onSelect|stopPropagation|preventDefault/);
  });
});
