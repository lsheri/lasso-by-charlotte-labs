import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOOLBAR_GAP, TOOLBAR_DIVIDER_WIDTH, planToolbarOverflow, toolbarDividersBefore, type ToolbarControlSpec } from "@/lib/toolbar-overflow";

const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");
const surface = readFileSync("src/components/canvas-lab/BoardToolbarSurface.tsx", "utf8");

describe("TOOLBAR-2 grouped toolbar", () => {
  it("orders all controls in four groups on one canvas surface", () => {
    const groups = page.match(/const TOOLBAR_GROUPS: string\[\]\[\] = \[([\s\S]*?)\];/)?.[1] ?? "";
    expect(groups).toContain('["add-work"]');
    expect(groups).toContain('["add-text", "add-sticky", "region", "section", "suggest"]');
    expect(groups).toContain('["fit", "zoom", "card-face"]');
    expect(page).toContain('spec: { id: "card-face", width: 68 }');
    expect(groups).toContain('"ask", "share", "details", "example"]');
    expect(page).toContain('const boardToolbarItems = toolbarItems.filter((item) => item.spec.id !== "example")');
    expect(page).not.toContain('<header className="relative z-20 flex h-[52px]');
    expect(page.match(/<BoardToolbarSurface /g)).toHaveLength(1);
    const canvas = page.slice(page.indexOf('<BoardFileDropOverlay'), page.indexOf('{sharedSpace ?', page.indexOf('<BoardFileDropOverlay')));
    expect(canvas).toContain('<BoardToolbarSurface items={boardToolbarItems}');
    expect(canvas).toContain('exampleToolbarItem?.menu');
    expect(canvas).toContain('virtualRef={detailsAnchorVirtualRef}');
    expect(canvas).toContain('<DemoPresetsAdmin engagementId={engagementId} />');
    expect(canvas).toContain('role="alert"');
    expect(page).toContain('{title}');
    expect(page).toContain('{status}');
    expect(canvas).toContain('<RegionColourSwatches');
    expect(canvas).toContain('<SectionBackgroundPicker');
    expect(surface).not.toContain('className="canvas-lab-tool-group"');
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
    expect(surface).toContain('<span aria-hidden="true" className="canvas-lab-toolbar-divider" />');
  });
});
