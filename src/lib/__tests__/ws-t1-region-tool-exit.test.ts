import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");

function slice(from: string, to: string): string {
  const start = page.indexOf(from);
  const end = page.indexOf(to, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return page.slice(start, end);
}

describe("WS-T1 region tool exits after creation, Escape and an empty click", () => {
  it("a drawn grouping closes the tray and exits the tool", () => {
    const createPaintRegion = slice("async function createPaintRegion", "setPendingRegionNameId(id)");

    expect(createPaintRegion).toContain("setDrawTool(false)");
    expect(createPaintRegion).not.toContain("setDrawTool(nextTool.armed)");
  });

  it("the inline + workstream path closes the tray and exits the tool", () => {
    const addWorkstream = slice("function addWorkstream(nameInput: string)", "return true;");

    expect(addWorkstream).toContain("setDrawTool(false)");
  });

  it("Escape cancels the tool through cancelDraw", () => {
    const onBoardKey = slice('if (event.key === "Escape")', "const resize = resizeRef.current");
    const cancelDraw = slice("function cancelDraw()", "function toggleDrawTool()");

    expect(onBoardKey).toContain("cancelDraw()");
    expect(cancelDraw).toContain("setDrawTool(false)");
  });

  it("an empty-canvas click exits the tool without creating anything", () => {
    const endDrawing = slice("function endDrawing()", "function cancelDrawing()");

    expect(endDrawing).toMatch(/!drawnRectUsable\(rect\)\) \{ setDrawTool\(false\)/);
    expect(endDrawing).not.toMatch(/!drawnRectUsable\(rect\)[\s\S]*createPaintRegion/);
  });

  it("the toolbar button still toggles the tool on and off", () => {
    const toggle = slice("function toggleDrawTool()", "async function persistDrawnFrame");

    expect(toggle).toContain("if (drawTool || pendingWorkstream)");
    expect(toggle).toContain("cancelDraw()");
    expect(toggle).toContain("setDrawTool(true)");
    expect(page).toContain('aria-pressed={drawTool}');
    expect(page).toContain("onClick={toggleDrawTool}");
  });

  it("the swatch tray still renders only while the tool is on", () => {
    expect(page).toContain("{drawTool ? <div className=\"canvas-lab-region-palette\">");
  });
});
