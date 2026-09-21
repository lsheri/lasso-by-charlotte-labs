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
});