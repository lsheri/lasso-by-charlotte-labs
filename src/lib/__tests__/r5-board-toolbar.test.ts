import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { TOOLBAR_GAP, planToolbarOverflow, type ToolbarControlSpec } from "@/lib/toolbar-overflow";

const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
const icons = readFileSync("src/components/notebook/icons.tsx", "utf8");
const share = readFileSync("src/components/canvas-lab/ShareDialog.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");
const toolbar = page.slice(page.indexOf("const toolbarItems"), page.indexOf("const toolbarPlan"));

describe("R5 board toolbar", () => {
  it("uses the existing GraphiteIcon system with one distinct icon per control", () => {
    expect(page).toContain('import { GraphiteIcon } from "@/components/notebook/icons"');
    expect(toolbar).not.toMatch(/<(?:Square|Type|StickyNote|LayoutTemplate|Eye|Info|Maximize2|Sparkles|FileText)\b/);
    expect(share).not.toContain('from "lucide-react"');

    const mappings = [...toolbar.matchAll(/data-toolbar-control="([^"]+)"[\s\S]*?<GraphiteIcon name="([^"]+)"/g)];
    const iconNames = mappings.map((match) => match[2]);
    expect(mappings.length).toBeGreaterThanOrEqual(12);
    expect(new Set(iconNames).size).toBe(iconNames.length);
    expect(toolbar).toContain('<LassoThinkingMark kind="signature" size={LOOP_SIZE_TOOLBAR} />');
  });

  it("keeps Add work visible and labels only the unclear controls", () => {
    expect(toolbar).toMatch(/data-toolbar-control="add-work"[\s\S]*?<GraphiteIcon name="work"[\s\S]*?>Add work<\/Button>/);
    // R9: Details opens the glance popover in place instead of linking away.
    expect(toolbar).toMatch(/data-toolbar-control="details"[\s\S]*?>Details<\/Button>/);
    expect(toolbar).toMatch(/data-toolbar-control="example"[\s\S]*?>See an example board<\/Button>/);
  });

  it("gives the canvas loop only to the Ask Lasso control", () => {
    const ask = toolbar.match(/data-toolbar-control="ask"[\s\S]*?toolbarItems\.push/s)?.[0] ?? "";
    expect(ask).toContain('<LassoThinkingMark kind="signature" size={LOOP_SIZE_TOOLBAR} />');
    expect(toolbar.replace(ask, "")).not.toContain("LassoThinkingMark");
    expect(toolbar.replace(ask, "")).not.toContain("text-green");
    const askEntry = icons.match(/"ask-lasso": \{ d: \[(.*?)\], sig:/)?.[1] ?? "";
    expect(askEntry).toContain("M13.6 5.7C9.2 3.5 4 6.1 4.1 10.3c.1 3.6 4.4 6 8.3 4.7 3.5-1.1 4.6-5 2.3-6.6-1.5-1.1-4.1-.4-4.4 1.3");
    expect(askEntry).toMatch(/[Cc]/);
    expect(askEntry).not.toMatch(/[zZ]/);
    expect(css).not.toMatch(/canvas-lab-ask-(?:drift|float|tilt)/);
  });

  it("removes the retired card display control without removing its icon definition", () => {
    expect(icons).toMatch(/sticky: \{ d: \[[^\]]+\]/);
    expect(toolbar).not.toContain('data-toolbar-control="preview"');
    expect(toolbar).not.toContain('data-toolbar-control="sticky"');
  });

  it("plans the wider labelled Add work control with the same larger gap as the row", () => {
    expect(TOOLBAR_GAP).toBe(8);
    expect(page).toContain('className="canvas-lab-toolbar flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden"');
    const controls: ToolbarControlSpec[] = [
      { id: "workstreams", width: 40, moveOrder: 1 },
      { id: "add-work", width: 112, pinned: true },
      { id: "ask", width: 40, pinned: true },
      { id: "zoom", width: 116, pinned: true },
    ];
    const plan = planToolbarOverflow(390, controls);
    expect(plan.row).toContain("add-work");
    expect(plan.overflow.length).toBeGreaterThan(0);
    expect([...plan.row, ...plan.overflow].sort()).toEqual(controls.map((control) => control.id).sort());
  });

  it("retains an accessible name and tooltip for every icon-only control", () => {
    for (const label of ["Show workstreams", "Working from", "Add text", "Add grouping", "Ask Lasso", "Share", "Fit", "Zoom out", "Zoom in", "More board controls"]) {
      expect(`${page}\n${share}`).toContain(`aria-label="${label}"`);
    }
    expect(toolbar.match(/<ToolbarIcon label=/g)?.length).toBeGreaterThanOrEqual(8);
  });
});