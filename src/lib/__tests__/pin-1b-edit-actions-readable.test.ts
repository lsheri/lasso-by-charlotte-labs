import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { labInverseZoom } from "@/components/canvas-lab/canvas-lab-model";

const card = readFileSync("src/components/canvas-lab/LabAnswerCard.tsx", "utf8");
const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");

describe("PIN-1b Done and Cancel stay readable when zoomed out", () => {
  it("the actions row counter-zooms with the stage's inverse zoom, under ask-v2 only", () => {
    expect(card).toContain(
      '.canvas-lab-answer-card[data-v2="true"] [data-testid="answer-edit-actions"] { zoom: var(--lab-inverse-zoom, 1); }',
    );
  });
  it("the stage sets that value on render and during a live zoom", () => {
    expect(page).toMatch(/"--lab-inverse-zoom": labInverseZoom\(zoom\)/);
    expect(page).toMatch(
      /stage\.style\.setProperty\("--lab-inverse-zoom", String\(labInverseZoom\(z\)\)\)/,
    );
  });
  it("on screen the 28 px buttons stay at least 22 px tall from 40% zoom up", () => {
    const onScreen = (zoom: number) => 28 * zoom * labInverseZoom(zoom);
    expect(onScreen(0.4)).toBeGreaterThanOrEqual(22);
    expect(onScreen(0.5)).toBeCloseTo(28);
    expect(onScreen(1)).toBeCloseTo(28);
    // Without the counter-zoom: the measured 11 px at 40%.
    expect(28 * 0.4).toBeLessThan(12);
  });
});
