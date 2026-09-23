import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { shouldEndOnMove } from "@/components/canvas-lab/canvas-lab-pointer";

const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");
const overlay = readFileSync("src/components/canvas-lab/LabRelationshipOverlays.tsx", "utf8");

describe("B1 stuck drag", () => {
  it("ends a live interaction on a move with no buttons held", () => {
    expect(shouldEndOnMove(0, true)).toBe(true);
    expect(shouldEndOnMove(1, true)).toBe(false);
    expect(shouldEndOnMove(0, false)).toBe(false);
  });

  it("wires pointercancel, blur and one shared end path", () => {
    expect(page).toContain('window.addEventListener("pointercancel", onUp)');
    expect(page).toContain('window.addEventListener("blur", onBlur)');
    expect(page).toContain('window.addEventListener("pointercancel", endDrawing)');
    expect(page).toContain("function endInteraction(");
    expect(page).toContain("shouldEndOnMove(event.buttons, interactionLive())");
  });

  it("lets a release over an embedded preview reach the board", () => {
    expect(css).toContain('.canvas-lab-surface[data-interacting="true"] iframe { pointer-events: none; }');
    expect(page).toContain("data-interacting=");
  });
});

describe("B1 one kind of link", () => {
  it("no longer renders the relation picker or a change control", () => {
    expect(page).not.toContain("<LabRelationPicker");
    expect(page).not.toContain("Change relation");
    expect(page).not.toContain("setRelationPicker");
    expect(overlay).not.toContain("Change relation");
    expect(overlay).not.toContain("onChangeRelation");
  });
});
