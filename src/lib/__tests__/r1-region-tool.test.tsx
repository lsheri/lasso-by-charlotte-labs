import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RegionColourSwatches } from "@/components/canvas-lab/RegionColourSwatches";
import { boardHasSeededStructure } from "@/components/canvas-lab/canvas-lab-model";
import { REGION_FILLS, newRegionFrameId, regionToolAfterDraw } from "@/lib/board-region";

describe("R1 region tool", () => {
  it("offers every stored fill as a colour-only swatch", () => {
    const onChange = vi.fn();
    const markup = renderToStaticMarkup(<RegionColourSwatches value={REGION_FILLS[0]} onChange={onChange} />);

    expect(markup.match(/<button/g)).toHaveLength(REGION_FILLS.length);
    expect(markup).not.toMatch(/>[^<]+<\/button>/);
    for (const fill of REGION_FILLS) expect(markup).toContain(`aria-label="${fill.replace("-", " ")}"`);
  });

  it("keeps the armed fill after one region so a second drag uses it", () => {
    expect(regionToolAfterDraw("rose-vivid")).toEqual({
      armed: true,
      fill: "rose-vivid",
    });
  });

  it("a saved paint region does not mount the fixed trail or change the camera", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const createPaintRegion = page.match(/async function createPaintRegion[\s\S]*?\n  }\n\n  \/\*\*/)?.[0] ?? "";

    expect(boardHasSeededStructure({ frames: [{ kind: "custom", key: newRegionFrameId("one"), label: null }] })).toBe(false);
    expect(boardHasSeededStructure({ frames: [{ kind: "custom", key: newRegionFrameId("one"), label: "Pricing" }] })).toBe(true);
    expect(createPaintRegion).not.toMatch(/setPan|setZoom|fit\(/);
    expect(page).toContain("{showGuides ? <ReasoningTrailGuide");
  });

  it("renders icon controls with accessible names for grouping and text", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");

    expect(page).toMatch(/aria-label="Add grouping"[\s\S]*?<GraphiteIcon name="grouping"/);
    expect(page).toMatch(/aria-label="Add text"[\s\S]*?<Type/);
  });

  it("uses grouping, never region, in toolbar copy and drawing announcements", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const toolbar = page.slice(page.indexOf("const toolbarItems"), page.indexOf("const toolbarPlan"));
    const drawingFlow = page.slice(page.indexOf("function cancelDraw"), page.indexOf("async function persistDrawnFrame"));

    const visibleCopy = `${toolbar}\n${drawingFlow}`.match(/(?:aria-label|label)=\"[^\"]*\"|setAnnouncement\(\"[^\"]*\"\)|>[^<>{}]+</g)?.join("\n") ?? "";
    expect(visibleCopy).not.toMatch(/\bregion\b/i);
    expect(toolbar).toContain('aria-label="Add grouping"');
    expect(drawingFlow).toContain('"Drag on empty board space to draw a grouping."');
  });

  it("anchors the just-drawn naming bar to its grouping", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const frame = readFileSync("src/components/canvas-lab/LabFrame.tsx", "utf8");

    expect(page).toContain("setPendingRegionNameId(id)");
    expect(page).toContain("<GroupingNamePopup");
    expect(page).not.toContain("namingPrompt={pendingRegionNameId === frame.id}");
    expect(frame).not.toContain('"canvas-lab-grouping-name-bar"');
  });

  it("dismisses naming without creating a workstream and preserves the named event", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const frame = readFileSync("src/components/canvas-lab/LabFrame.tsx", "utf8");
    const regionLogic = readFileSync("src/lib/board-region.ts", "utf8");

    expect(page).toContain("onDismiss={() => setPendingRegionNameId(null)}");
    expect(regionLogic).toContain('REGION_NAMING_LINE = "Name this and it becomes a workstream. It claims the work inside, and you can call it with @."');
    expect(page).toContain('noteWorkboardRegionNamed(orgId, "named", claimed, frame.fill)');
    expect(page).toContain('noteWorkboardRegionNamed(orgId, "cleared", filedWorkCount(released), frame.fill)');
  });
});