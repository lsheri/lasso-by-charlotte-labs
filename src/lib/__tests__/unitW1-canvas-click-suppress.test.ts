import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CLICK_SUPPRESS_PX,
  beginClickGesture,
  cancelClickGesture,
  endClickGesture,
  movedBeyondClick,
  swallowClickIfDrag,
  type ClickSuppress,
} from "@/lib/canvas-drag";

const view = readFileSync("src/components/canvas/EngagementCanvasView.tsx", "utf8");

/**
 * A DOM stand-in wired exactly the way EngagementCanvasView wires a card:
 * pointerdown begins the gesture, pointerup ends it against the press point,
 * and a capture-phase click handler swallows the click once when the gesture
 * was a drag. The source pins below hold the real component to the same calls.
 */
function harness() {
  const suppress: ClickSuppress = { current: false };
  const card = document.createElement("div");
  let start: { x: number; y: number } | null = null;
  let opened = 0;
  card.addEventListener("pointerdown", (event) => {
    beginClickGesture(suppress);
    start = { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
  });
  card.addEventListener("pointerup", (event) => {
    if (!start) return;
    endClickGesture(suppress, start, {
      x: (event as MouseEvent).clientX,
      y: (event as MouseEvent).clientY,
    });
  });
  card.addEventListener("pointercancel", () => cancelClickGesture(suppress));
  card.addEventListener(
    "click",
    (event) => {
      if (swallowClickIfDrag(suppress)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      opened += 1;
    },
    true,
  );
  const press = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    card.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, ...from }));
    card.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, ...to }));
    card.dispatchEvent(new MouseEvent("click", { bubbles: true, ...to }));
  };
  return { card, press, opened: () => opened, suppress };
}

describe("unit W1 click suppress threshold", () => {
  it("is a named constant of about four pixels", () => {
    expect(CLICK_SUPPRESS_PX).toBe(4);
  });

  it("measures straight-line distance, not per axis", () => {
    const origin = { x: 100, y: 100 };
    // Each axis inside the threshold, but the diagonal past it: a drag.
    const diagonal = CLICK_SUPPRESS_PX * 0.75;
    expect(
      movedBeyondClick(origin, { x: origin.x + diagonal, y: origin.y + diagonal }),
    ).toBe(true);
    // Exactly at the threshold a click still opens.
    expect(movedBeyondClick(origin, { x: origin.x + CLICK_SUPPRESS_PX, y: origin.y })).toBe(
      false,
    );
  });
});

describe("unit W1 pointer gestures", () => {
  it("case 1: press, move 20 pixels, release moves the card and does not open", () => {
    const scene = harness();
    scene.press({ x: 50, y: 50 }, { x: 70, y: 50 });
    expect(scene.opened()).toBe(0);
  });

  it("case 2: press and release without moving opens the card", () => {
    const scene = harness();
    scene.press({ x: 50, y: 50 }, { x: 50, y: 50 });
    expect(scene.opened()).toBe(1);
  });

  it("case 3: press, move 2 pixels, release still opens the card", () => {
    const scene = harness();
    const two = Math.min(2, CLICK_SUPPRESS_PX - 1);
    scene.press({ x: 50, y: 50 }, { x: 50 + two, y: 50 });
    expect(scene.opened()).toBe(1);
  });

  it("suppression lasts one gesture and never swallows the next real click", () => {
    const scene = harness();
    scene.press({ x: 50, y: 50 }, { x: 90, y: 90 });
    expect(scene.opened()).toBe(0);
    // A drag that ended off the card left the flag set; the next press clears it.
    scene.suppress.current = true;
    scene.press({ x: 10, y: 10 }, { x: 10, y: 10 });
    expect(scene.opened()).toBe(1);
  });

  it("a cancelled gesture clears the flag", () => {
    const scene = harness();
    scene.card.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 5, clientY: 5 }));
    scene.suppress.current = true;
    scene.card.dispatchEvent(new MouseEvent("pointercancel", { bubbles: true }));
    scene.card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(scene.opened()).toBe(1);
  });
});

describe("unit W1 the real canvas uses this path", () => {
  it("begins, ends and cancels the gesture in the pointer drag", () => {
    expect(view).toContain("beginClickGesture(suppressClickRef)");
    expect(view).toContain("endClickGesture(");
    expect(view).toContain("cancelClickGesture(suppressClickRef)");
  });

  it("swallows the click in capture phase on the card and the shelf", () => {
    expect(view.match(/swallowClickIfDrag\(suppressClickRef\)/g)?.length).toBe(2);
  });

  it("no longer suppresses from the hold timer or the lift", () => {
    expect(view).not.toContain("suppressClickRef.current = true");
  });
});
