import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");

describe("HAND-1: the hand tool", () => {
  it("is a toggle in the toolbar's view group, kept until clicked again, and in the overflow menu", () => {
    expect(page).toContain('["hand", "fit", "zoom", "card-face"]');
    expect(page).toMatch(/aria-label="Hand" aria-pressed=\{handOn\} data-toolbar-control="hand" onClick=\{\(\) => setHandOn\(\(on\) => !on\)\}/);
    expect(page).toMatch(/<DropdownMenuItem onSelect=\{\(\) => setHandOn\(\(on\) => !on\)\}>/);
  });
  it("uses the Space-pan path: a plain press pans, even over a card, but never over Ask, menus or the toolbar", () => {
    expect(page).toMatch(/if \(event\.button === 0 && \(spaceRef\.current \|\| \(handRef\.current && !\(event\.target instanceof Element && event\.target\.closest\(HAND_SKIPS\)\)\)\)\) \{ event\.preventDefault\(\); event\.stopPropagation\(\); startSpacePan\(event\); \}/);
    expect(page).toContain(`const HAND_SKIPS = ".canvas-lab-floating-tools, .ask-draft, [role='dialog'], [role='menu']`);
    expect(page).toContain("if (spaceRef.current || handRef.current) return; // Space or the hand tool pans the board");
    expect(page).toContain("if (spaceRef.current || handRef.current || event.button !== 0 || !boardEditable) return;");
  });
  it("shows the hand everywhere on the board while on", () => {
    expect(page).toContain('data-hand={handOn ? "true" : undefined}');
    expect(css).toContain('.canvas-lab-surface[data-hand="true"], .canvas-lab-surface[data-hand="true"] [data-testid="canvas-lab-stage"] * { cursor: grab !important; }');
  });
  it("a sideways swipe never becomes browser back or forward while a board is open", () => {
    expect(css).toContain(".canvas-lab-surface { overscroll-behavior-x: none; }");
    expect(css).toContain('html:has([data-testid="canvas-lab-shell"]), body:has([data-testid="canvas-lab-shell"]) { overscroll-behavior-x: none; }');
  });
});
