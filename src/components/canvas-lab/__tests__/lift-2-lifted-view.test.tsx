// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));

import { FEATURE_FLAGS, flagEnabled } from "@/lib/feature-flags";
import {
  LIFT_MIN,
  LIFT_MORPH_MS,
  liftable,
  liftDefaultSize,
  liftMoved,
  liftOpenRect,
  liftResized,
  liftZoom,
} from "@/lib/lift-view";
import { LIFT_COPY, LiftedWork } from "@/components/canvas-lab/LiftedWork";
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

describe("LIFT flag", () => {
  it("lift-v1 exists and is off by default, so double-click opens the full reader as before", () => {
    expect(FEATURE_FLAGS["lift-v1"].default).toBe(false);
    expect(flagEnabled("lift-v1")).toBe(false);
  });
});

describe("LIFT geometry: one default size, centred", () => {
  it("opens at 760 by 600 on a large window", () => {
    expect(liftDefaultSize({ width: 1600, height: 1000 })).toEqual({ width: 760, height: 600 });
    expect(liftOpenRect({ width: 1600, height: 1000 })).toEqual({
      left: 420,
      top: 200,
      width: 760,
      height: 600,
    });
  });
  it("shrinks to 70% by 75% of a small window, never under the minimum", () => {
    expect(liftDefaultSize({ width: 1000, height: 700 })).toEqual({ width: 700, height: 525 });
    expect(liftDefaultSize({ width: 300, height: 200 })).toEqual({
      width: LIFT_MIN.width,
      height: LIFT_MIN.height,
    });
  });
  it("is the same every time: nothing about a last resize is an input", () => {
    expect(liftOpenRect.length).toBe(1);
  });
});

describe("LIFT moves and resizes", () => {
  const vp = { width: 1600, height: 1000 };
  const start = { left: 420, top: 200, width: 760, height: 600 };
  it("follows a header drag", () => {
    expect(liftMoved(start, 100, -50, vp)).toEqual({ ...start, left: 520, top: 150 });
  });
  it("keeps enough on screen to catch it again, and never above the top", () => {
    expect(liftMoved(start, 5000, 5000, vp).left).toBe(1520);
    expect(liftMoved(start, -5000, -5000, vp)).toMatchObject({ left: 80 - 760, top: 0 });
  });
  it("grows from the south-east corner, the north-west corner staying put", () => {
    expect(liftResized(start, "se", 40, 30, vp)).toEqual({
      left: 420,
      top: 200,
      width: 800,
      height: 630,
    });
  });
  it("grows from the north-west corner, the south-east corner staying put", () => {
    expect(liftResized(start, "nw", -40, -30, vp)).toEqual({
      left: 380,
      top: 170,
      width: 800,
      height: 630,
    });
  });
  it("compresses no smaller than the minimum and no larger than the window", () => {
    expect(liftResized(start, "se", -5000, -5000, vp)).toMatchObject({
      width: LIFT_MIN.width,
      height: LIFT_MIN.height,
    });
    expect(liftResized(start, "se", 5000, 5000, vp)).toMatchObject({ width: 1600, height: 1000 });
  });
});

describe("LIFT which cards lift", () => {
  it("work lifts", () => {
    for (const type of ["ai_thread", "document", "deck", "sheet", "email", "file"])
      expect(liftable({ type })).toBe(true);
  });
  it("the decisions document keeps its ledger, and a file piece with no bytes yet keeps its open", () => {
    expect(liftable({ type: "document", doc_kind: "decisions" })).toBe(false);
    expect(liftable({ type: "document", content_fidelity: "reference" })).toBe(false);
  });
  it("a card with no work item (a local note) keeps its own double-click", () => {
    expect(liftable(undefined)).toBe(false);
    expect(liftable(null)).toBe(false);
  });
});

describe("LIFT reading size", () => {
  it("enlarges the 480 px preview to fill the view, never past 1.5, never shrinking it", () => {
    expect(liftZoom(760)).toBe(1.48);
    expect(liftZoom(2000)).toBe(1.5);
    expect(liftZoom(320)).toBe(1);
  });
});

function renderLift(props: Partial<Parameters<typeof LiftedWork>[0]> = {}) {
  const onClose = vi.fn();
  const onExpand = vi.fn();
  const utils = render(
    <LiftedWork
      title="Series A brief"
      origin={null}
      onClose={onClose}
      onExpand={onExpand}
      {...props}
    >
      {(width) => <p data-testid="lift-content">width {width}</p>}
    </LiftedWork>,
  );
  return { onClose, onExpand, ...utils };
}

describe("LIFT the view", () => {
  it("is a labelled dialog over the board, with the work inside at the default size", () => {
    renderLift();
    const panel = screen.getByRole("dialog", { name: "Series A brief" });
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByTestId("lift-content").textContent).toBe(
      `width ${liftOpenRect({ width: window.innerWidth, height: window.innerHeight }).width}`,
    );
    expect(screen.getByTestId("lift-backdrop")).toBeTruthy();
  });
  it("Back to the board closes it", () => {
    const { onClose } = renderLift();
    fireEvent.click(screen.getByRole("button", { name: LIFT_COPY.compress }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("Esc closes it and never reaches the board's own Esc", () => {
    const { onClose } = renderLift();
    const boardEsc = vi.fn();
    window.addEventListener("keydown", boardEsc);
    fireEvent.keyDown(document.body, { key: "Escape" });
    window.removeEventListener("keydown", boardEsc);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(boardEsc).not.toHaveBeenCalled();
  });
  it("a press on the dimmed board closes it", () => {
    const { onClose } = renderLift();
    fireEvent.pointerDown(screen.getByTestId("lift-backdrop"), { button: 0 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("Expand hands over the view's box for the full reader to grow from", () => {
    const { onExpand, onClose } = renderLift();
    fireEvent.click(screen.getByRole("button", { name: LIFT_COPY.expand }));
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onExpand.mock.calls[0]?.[0]).toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(onClose).not.toHaveBeenCalled();
  });
  it("grown from a card, it shrinks back into that card before it closes", () => {
    vi.useFakeTimers();
    const origin = { left: 10, top: 20, width: 260, height: 220 };
    const { onClose } = renderLift({ origin });
    act(() => {
      vi.advanceTimersByTime(LIFT_MORPH_MS + 100);
    });
    fireEvent.click(screen.getByRole("button", { name: LIFT_COPY.compress }));
    const panel = screen.getByTestId("lift-panel");
    expect(panel.style.left).toBe("10px");
    expect(panel.style.width).toBe("260px");
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(LIFT_MORPH_MS);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("presses, clicks, wheels and keys inside it stop at its root, so the board never pans, selects, deletes or zooms", () => {
    const outside = { pointerDown: vi.fn(), click: vi.fn(), wheel: vi.fn(), keyDown: vi.fn() };
    render(
      <div
        onPointerDown={outside.pointerDown}
        onClick={outside.click}
        onWheel={outside.wheel}
        onKeyDown={outside.keyDown}
      >
        <LiftedWork title="t" origin={null} onClose={() => undefined} onExpand={() => undefined}>
          {() => <p data-testid="inside">x</p>}
        </LiftedWork>
      </div>,
    );
    const inside = screen.getByTestId("inside");
    fireEvent.pointerDown(inside, { button: 0 });
    fireEvent.click(inside);
    fireEvent.wheel(inside);
    fireEvent.keyDown(inside, { key: "Backspace" });
    expect(outside.pointerDown).not.toHaveBeenCalled();
    expect(outside.click).not.toHaveBeenCalled();
    expect(outside.wheel).not.toHaveBeenCalled();
    expect(outside.keyDown).not.toHaveBeenCalled();
  });
  it("a header drag moves it and a corner drag resizes it, and neither calls anything outside", () => {
    const { onClose, onExpand } = renderLift();
    const panel = screen.getByTestId("lift-panel");
    const before = { left: parseFloat(panel.style.left), width: parseFloat(panel.style.width) };
    const head = panel.querySelector("header")!;
    fireEvent.pointerDown(head, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(head, { clientX: 130, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(head, { pointerId: 1 });
    expect(parseFloat(panel.style.left)).toBe(before.left + 30);
    const se = panel.querySelector<HTMLElement>('[data-corner="se"]')!;
    fireEvent.pointerDown(se, { button: 0, clientX: 0, clientY: 0, pointerId: 2 });
    fireEvent.pointerMove(se, { clientX: -100, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(se, { pointerId: 2 });
    expect(parseFloat(panel.style.width)).toBe(Math.max(LIFT_MIN.width, before.width - 100));
    expect(onClose).not.toHaveBeenCalled();
    expect(onExpand).not.toHaveBeenCalled();
  });
});

function renderCard(onOpen: () => void, onLift?: () => void) {
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
      onSelect={() => undefined}
      onOpen={onOpen}
      onLift={onLift}
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
      onPointerDown={() => undefined}
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

describe("LIFT on the card", () => {
  it("with lift on, a double-click lifts and does not open the full reader", () => {
    const onOpen = vi.fn();
    const onLift = vi.fn();
    const { container } = renderCard(onOpen, onLift);
    const card = container.querySelector<HTMLElement>("[aria-roledescription=card]")!;
    fireEvent.doubleClick(card);
    expect(onLift).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
  it("with lift off, a double-click opens the full reader as before", () => {
    const onOpen = vi.fn();
    const { container } = renderCard(onOpen);
    const card = container.querySelector<HTMLElement>("[aria-roledescription=card]")!;
    fireEvent.doubleClick(card);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
  it("the card's Open button still opens the full reader, lift or not", () => {
    const onOpen = vi.fn();
    const onLift = vi.fn();
    renderCard(onOpen, onLift);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onLift).not.toHaveBeenCalled();
  });
});

describe("LIFT on the board page (nothing renders that page in tests, so its wiring is pinned in source)", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  it("lifts only behind lift-v1 and only work that lifts", () => {
    expect(page).toContain('const liftV1 = flagEnabled("lift-v1");');
    expect(page).toContain("onLift={liftV1 && liftable(cardItem) ? ");
  });
  it("the board's Delete, Backspace and Esc stand down while a view is lifted", () => {
    const fn = page.slice(
      page.indexOf("function onBoardKey"),
      page.indexOf("function onBoardKey") + 400,
    );
    expect(fn).toContain("if (liftedRef.current) return;");
  });
  it("undo and zoom keys stand down too", () => {
    expect(page).toContain(
      "if (cardMenuOpen || menuOpen || focusId || reviewId || liftedRef.current) return;",
    );
    const zoom = page.slice(
      page.indexOf("function onZoomKey"),
      page.indexOf("function onZoomKey") + 200,
    );
    expect(zoom).toContain("if (liftedRef.current) return;");
  });
  it("a lifted card that leaves the board closes its view", () => {
    expect(page).toContain(
      "useEffect(() => { if (lifted && (!liftedNode || !liftedItem)) setLifted(null); }, [lifted, liftedNode, liftedItem]);",
    );
  });
  it("Expand opens the full reader from the view's box, and lifting writes nothing", () => {
    expect(page).toContain(
      "openNode(liftedNode, new DOMRect(rect.left, rect.top, rect.width, rect.height))",
    );
    const liftLine = page.slice(page.indexOf("<LiftedWork "), page.indexOf("</LiftedWork>"));
    expect(liftLine).not.toMatch(
      /persistNodePatch|persistFramePatch|recordEvent|logEvent|note[A-Z]/,
    );
  });
});
