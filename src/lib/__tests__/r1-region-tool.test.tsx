import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RegionColourSwatches } from "@/components/canvas-lab/RegionColourSwatches";
import { boardHasSeededStructure } from "@/components/canvas-lab/canvas-lab-model";
import { REGION_FILLS, newRegionFrameId, regionToolAfterDraw } from "@/lib/board-region";

afterEach(cleanup);

describe("R1 region tool", () => {
  it("offers every stored fill as a colour-only swatch", () => {
    const onChange = vi.fn();
    const { container } = render(<RegionColourSwatches value={REGION_FILLS[0]} onChange={onChange} />);
    const controls = screen.getAllByRole("button");

    expect(controls).toHaveLength(REGION_FILLS.length);
    expect(container.textContent).toBe("");
    fireEvent.click(controls.at(-1) as HTMLButtonElement);
    expect(onChange).toHaveBeenCalledWith(REGION_FILLS.at(-1));
  });

  it("keeps the armed fill after one region so a second drag uses it", () => {
    expect(regionToolAfterDraw({ fill: "rose-vivid", pan: { x: 81, y: -42 }, zoom: 0.7 })).toEqual({
      armed: true,
      fill: "rose-vivid",
      pan: { x: 81, y: -42 },
      zoom: 0.7,
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