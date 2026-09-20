/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { scrollableUnder, wheelPanVector } from "../canvas-zoom";
import { needsHighlightForComment } from "../canvas-lab-annotations-shared";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

/** A stand-in for a preview mini-window inside the board. */
function makeShellWithPane(overflowY: string, scrollTop: number) {
  const shell = document.createElement("div");
  const pane = document.createElement("div");
  shell.appendChild(pane);
  document.body.appendChild(shell);
  Object.defineProperty(pane, "clientHeight", { value: 100, configurable: true });
  Object.defineProperty(pane, "scrollHeight", { value: 300, configurable: true });
  pane.scrollTop = scrollTop;
  pane.style.overflowY = overflowY;
  return { shell, pane };
}

describe("pass 201 — wheel pan", () => {
  it("pans down and up from a plain wheel, in pixels or lines", () => {
    expect(wheelPanVector({ deltaX: 0, deltaY: 40 })).toEqual({ x: 0, y: 40 });
    expect(wheelPanVector({ deltaX: 0, deltaY: -2, deltaMode: 1 })).toEqual({ x: 0, y: -32 });
  });

  it("pans sideways on a horizontal delta and on shift plus wheel", () => {
    expect(wheelPanVector({ deltaX: 25, deltaY: 0 })).toEqual({ x: 25, y: 0 });
    expect(wheelPanVector({ deltaX: 0, deltaY: 30, shiftKey: true })).toEqual({ x: 30, y: 0 });
    expect(wheelPanVector({ deltaX: 8, deltaY: 30, shiftKey: true })).toEqual({ x: 8, y: 30 });
  });

  it("leaves ctrl and cmd wheels to the zoom path, and never smooths the pan", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain("if (!event.ctrlKey && !event.metaKey) return;");
    expect(page).toContain("if (event.ctrlKey || event.metaKey) return;");
    expect(page).toContain("setPan((current) => ({ x: current.x - delta.x, y: current.y - delta.y }))");
    expect(page).not.toContain("requestAnimationFrame(panSmooth");
  });

  it("an unfocused preview card never takes the wheel", () => {
    const { shell, pane } = makeShellWithPane("hidden", 0);
    expect(scrollableUnder(pane, shell, { x: 0, y: 40 })).toBe(false);
  });

  it("a focused preview card scrolls first, then falls through at its end", () => {
    const top = makeShellWithPane("auto", 0);
    expect(scrollableUnder(top.pane, top.shell, { x: 0, y: 40 })).toBe(true);
    expect(scrollableUnder(top.pane, top.shell, { x: 0, y: -40 })).toBe(false);

    const bottom = makeShellWithPane("auto", 200);
    expect(scrollableUnder(bottom.pane, bottom.shell, { x: 0, y: 40 })).toBe(false);
    expect(scrollableUnder(bottom.pane, bottom.shell, { x: 0, y: -40 })).toBe(true);
  });

  it("records no event for moving the viewport", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    const wheelBlock = page.slice(page.indexOf("function onSurfaceWheel"), page.indexOf("shell.addEventListener(\"wheel\", onModifierWheel"));
    expect(wheelBlock).not.toContain("logEvent");
    expect(wheelBlock).not.toContain("note");
  });
});

describe("pass 201 — commenting marks the passage", () => {
  const anchor = { turnNo: 3, charStart: 10, charEnd: 40 };

  it("marks a fresh passage", () => {
    expect(needsHighlightForComment([], anchor)).toBe(true);
    expect(needsHighlightForComment([{ turnNo: 3, charStart: 12, charEnd: 40 }], anchor)).toBe(true);
    expect(needsHighlightForComment([{ turnNo: 4, charStart: 10, charEnd: 40 }], anchor)).toBe(true);
  });

  it("does not mark the same passage twice", () => {
    expect(needsHighlightForComment([{ turnNo: 3, charStart: 10, charEnd: 40 }], anchor)).toBe(false);
  });

  it("saves the mark through the existing highlight path and its own event", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain("if (!needsHighlightForComment(annotations.highlights, anchor)) return;");
    expect(page).toContain('noteHighlightChanged(orgId, "created", marked.highlight.visibility, marked.highlight.excerpt.length)');
  });
});
