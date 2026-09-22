import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CARD_MAX_WIDTH, CARD_MIN_WIDTH, fitCardRect } from "@/components/canvas-lab/canvas-lab-model";
import { contextAreaAvailability } from "@/lib/context-region";

describe("F4 context area removal and restore", () => {
  it("does not lazily recreate a context area that was removed", () => {
    expect(contextAreaAvailability({ active: false, archived: true, hasContent: true })).toEqual({ autoCreate: false, canAdd: true });
    expect(contextAreaAvailability({ active: false, archived: false, hasContent: true })).toEqual({ autoCreate: true, canAdd: true });
  });

  it("keeps all four removal labels distinct", () => {
    const frame = readFileSync("src/components/canvas-lab/LabFrameMenu.tsx", "utf8");
    const card = readFileSync("src/components/canvas-lab/LabCardMenu.tsx", "utf8");
    expect(frame).toContain("Remove the context area");
    expect(card).toContain("Take out of context");
    expect(card).toContain("Hide from this board");
    expect(card).toContain("Delete this work");
  });

  it("fits height without throwing away a person's card width", () => {
    expect(fitCardRect({ width: 400, height: 300 }, 220)).toEqual({ width: 400, height: 220 });
  });

  it("clamps fitted width to the interaction range", () => {
    expect(fitCardRect({ width: 180, height: 300 }, 120)).toEqual({ width: CARD_MIN_WIDTH, height: 220 });
    expect(fitCardRect({ width: 600, height: 300 }, 220)).toEqual({ width: CARD_MAX_WIDTH, height: 220 });
  });
});
