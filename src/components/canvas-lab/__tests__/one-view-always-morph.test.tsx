// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => true }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));

import { LiftedWork, LIFT_COPY } from "@/components/canvas-lab/LiftedWork";
import { LIFT_MORPH_MS } from "@/lib/lift-view";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const card = { left: 900, top: 500, width: 220, height: 170 };

describe("ONE VIEW: it grows out of the card and always shrinks back into it", () => {
  it("a tad slower than before: 320ms", () => {
    expect(LIFT_MORPH_MS).toBe(320);
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("animation: lift-fade 320ms ease-out both; }");
    expect(css).toContain("animation: lift-fade-out 320ms ease-in both; }");
  });

  it("the content fade reaches the work beside the Trail (it lives in lift-main now)", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain('.lift-panel[data-phase="from"] > .lift-head, .lift-panel[data-phase="from"] > .lift-main { opacity: 0; transition: none; }');
    expect(css).not.toContain(".lift-panel > .lift-body");
  });

  it("on close it shrinks into where the card is now, not where it was", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const moved = { left: 100, top: 80, width: 220, height: 170 };
    render(
      <LiftedWork title="Deck" kind="deck" origin={card} closeTo={() => moved} onClose={onClose}>
        {() => <p>x</p>}
      </LiftedWork>,
    );
    act(() => {
      vi.advanceTimersByTime(LIFT_MORPH_MS + 50);
    });
    const panel = screen.getByTestId("lift-panel");
    const box = { left: parseFloat(panel.style.left), top: parseFloat(panel.style.top) };
    fireEvent.click(screen.getByRole("button", { name: LIFT_COPY.compress }));
    expect(panel.getAttribute("data-phase")).toBe("closing");
    expect(panel.style.transform).toContain(`translate(${moved.left - box.left}px, ${moved.top - box.top}px)`);
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(LIFT_MORPH_MS);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reached by the arrows or the trail, it appears in place but still closes into its card", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <LiftedWork title="Sheet" kind="sheet" origin={card} animateOpen={false} closeTo={() => card} onClose={onClose}>
        {() => <p>x</p>}
      </LiftedWork>,
    );
    const panel = screen.getByTestId("lift-panel");
    expect(panel.getAttribute("data-phase")).toBe("open");
    expect(panel.style.transform).toBe("");
    fireEvent.click(screen.getByRole("button", { name: LIFT_COPY.compress }));
    expect(panel.getAttribute("data-phase")).toBe("closing");
    expect(panel.style.transform).toContain("scale(");
    act(() => {
      vi.advanceTimersByTime(LIFT_MORPH_MS);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("with no card to go back to (it left the board), it closes at once", () => {
    const onClose = vi.fn();
    render(
      <LiftedWork title="Deck" kind="deck" origin={null} closeTo={() => null} onClose={onClose}>
        {() => <p>x</p>}
      </LiftedWork>,
    );
    fireEvent.click(screen.getByRole("button", { name: LIFT_COPY.compress }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ONE VIEW on the board (pinned in source)", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const flags = readFileSync("src/lib/feature-flags.ts", "utf8");
  it("no flag decides which view opens: the old full-screen reader is never reached from a work card", () => {
    expect(page).not.toMatch(/liftV1|lift-v1/);
    expect(flags).not.toContain("lift-v1");
    expect(page).toContain("onOpen={(origin) => { if (liftable(cardItem)) liftCard(node, cardItem, origin); else openNode(node, origin); }}");
  });
  it("every view closes into its own card's box as it is now", () => {
    expect(page).toContain("closeTo={() => cardRect(liftedNode.id)} animateOpen={!lifted.swapped}");
    expect(page).toContain("closeTo={() => cardRect(liftedPicture.id)} animateOpen={!lifted.swapped}");
  });
  it("the arrows and the trail open in place, remembering their card", () => {
    expect(page).toContain("setLifted({ id: next.id, origin: cardRect(next.id), swapped: true,");
    expect(page).toContain('setLifted({ id: node.id, origin: cardRect(node.id), swapped: true, panel: "trail" });');
  });
});
