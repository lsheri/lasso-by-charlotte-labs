import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOOLBAR_GAP, TOOLBAR_DIVIDER_WIDTH, planToolbarOverflow, toolbarDividersBefore, type ToolbarControlSpec } from "@/lib/toolbar-overflow";

const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");

describe("TOOLBAR-2 grouped toolbar", () => {
  it("orders the row in Liam's five groups", () => {
    const groups = page.match(/const TOOLBAR_GROUPS: string\[\]\[\] = \[([\s\S]*?)\];/)?.[1] ?? "";
    expect(groups).toContain('["add-work"]');
    expect(groups).toContain('["add-text", "add-sticky"]');
    expect(groups).toContain('["region", "section", "suggest"]');
    expect(groups).toContain('["workstreams", "card-face", "fit", "zoom"]');
    expect(groups).toContain('"ask", "share", "details", "example"]');
  });

  it("draws a divider only between groups that still have a control in the row", () => {
    const row: ToolbarControlSpec[] = [
      { id: "a", width: 40, group: 1 },
      { id: "b", width: 40, group: 2 },
      { id: "c", width: 40, group: 2 },
      { id: "e", width: 40, group: 5 },
    ];
    expect(toolbarDividersBefore(row)).toEqual(["b", "e"]);
  });

  it("counts each divider as one rule plus one gap in the width budget", () => {
    const controls: ToolbarControlSpec[] = [
      { id: "a", width: 40, group: 1, pinned: true },
      { id: "b", width: 40, group: 2, moveOrder: 1 },
      { id: "c", width: 40, group: 3, pinned: true },
    ];
    const full = 120 + TOOLBAR_GAP * 2 + 2 * (TOOLBAR_DIVIDER_WIDTH + TOOLBAR_GAP);
    expect(planToolbarOverflow(full, controls).overflow).toEqual([]);
    expect(planToolbarOverflow(full - 1, controls).overflow).toEqual(["b"]);
  });

  it("gives the armed draw tools the open-Ask look", () => {
    expect(css).toContain('button:is([data-toolbar-control="grouping"], [data-toolbar-control="section"])[aria-pressed="true"]');
    expect(page).toContain('aria-pressed={drawTool && drawMode === "section"}');
    expect(page).toContain('<span aria-hidden="true" className="canvas-lab-toolbar-divider" />');
  });
});
