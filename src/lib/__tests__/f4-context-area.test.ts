import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CARD_MIN_WIDTH, fitCardRect } from "@/components/canvas-lab/canvas-lab-model";
import { contextAreaAvailability } from "@/lib/context-region";

describe("F4 context area removal and restore", () => {
  it("does not lazily recreate a context area that was removed", () => {
    expect(contextAreaAvailability({ active: false, archived: true, hasContent: true })).toEqual({ autoCreate: false, canAdd: true });
    expect(contextAreaAvailability({ active: false, archived: false, hasContent: true })).toEqual({ autoCreate: true, canAdd: false });
  });

  it("keeps all four removal labels distinct", () => {
    const frame = readFileSync("src/components/canvas-lab/LabFrameMenu.tsx", "utf8");
    const card = readFileSync("src/components/canvas-lab/LabCardMenu.tsx", "utf8");
    expect(frame).toContain("Remove the context area");
    expect(card).toContain("Take out of context");
    expect(card).toContain("Hide from this board");
    expect(card).toContain("Delete this work");
  });

  it("fits a card no narrower than the resize floor", () => {
    expect(fitCardRect({ width: 420, height: 300 }, 120)).toEqual({ width: CARD_MIN_WIDTH, height: 180 });
  });
});
