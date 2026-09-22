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
    expect(mappings.length).toBeGreaterThanOrEqual(13);
    expect(new Set(iconNames).size).toBe(iconNames.length);
  });

  it("keeps Add work visible and labels only the unclear controls", () => {
    expect(toolbar).toMatch(/data-toolbar-control="add-work"[\s\S]*?<GraphiteIcon name="work"[\s\S]*?>Add work<\/Button>/);
    expect(toolbar).toMatch(/data-toolbar-control="details"[\s\S]*?>Details<\/Link>/);
    expect(toolbar).toMatch(/data-toolbar-control="example"[\s\S]*?>See an example board<\/Button>/);
  });

  it("gives lime and ambient motion only to the loop-derived Ask Lasso icon", () => {
    const ask = toolbar.match(/data-toolbar-control="ask"[\s\S]*?toolbarItems\.push/s)?.[0] ?? "";
    expect(ask).toContain('name="ask-lasso"');
    expect(ask).toContain("canvas-lab-ask-icon");
    expect(ask).toContain("text-green");
    expect(toolbar.replace(ask, "")).not.toContain("text-green");
    expect(icons).toMatch(/"ask-lasso": \{ d: \["M10 3/);
    expect(css).toMatch(/\.canvas-lab-ask-icon[\s\S]*animation:[\s\S]*transform/);
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*\.canvas-lab-ask-icon[\s\S]*animation: none !important/);
    const motion = css.match(/@keyframes canvas-lab-ask-drift[\s\S]*?\n}/)?.[0] ?? "";
    expect(motion).toContain("transform:");
    expect(motion).not.toMatch(/(?:top|left|right|bottom|width|height):/);
  });

  it("plans the wider labelled Add work control with the same larger gap as the row", () => {
    expect(TOOLBAR_GAP).toBe(8);
    expect(page).toContain('className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden"');
    const controls: ToolbarControlSpec[] = [
      { id: "workstreams", width: 40, moveOrder: 1 },
      { id: "display", width: 76, moveOrder: 2 },
      { id: "add-work", width: 112, pinned: true },
      { id: "ask", width: 40, pinned: true },
      { id: "zoom", width: 116, pinned: true },
    ];
    const plan = planToolbarOverflow(310, controls);
    expect(plan.row).toContain("add-work");
    expect(plan.overflow.length).toBeGreaterThan(0);
    expect([...plan.row, ...plan.overflow].sort()).toEqual(controls.map((control) => control.id).sort());
  });

  it("retains an accessible name and tooltip for every icon-only control", () => {
    for (const label of ["Show workstreams", "Preview cards", "Sticky cards", "Working from", "Add text", "Add grouping", "Ask Lasso", "Share", "Fit", "Zoom out", "Zoom in", "More board controls"]) {
      expect(`${page}\n${share}`).toContain(`aria-label="${label}"`);
    }
    expect(toolbar.match(/<ToolbarIcon label=/g)?.length).toBeGreaterThanOrEqual(8);
  });
});