import { readFileSync } from "fs";
import { join } from "path";

import { describe, expect, it } from "vitest";

const CANVAS_SRC = readFileSync(
  join(process.cwd(), "src/components/canvas/EngagementCanvasView.tsx"),
  "utf8",
);
const PAGE_SRC = readFileSync(
  join(process.cwd(), "src/pages/EngagementPage.tsx"),
  "utf8",
);

describe("pass 194 — no hover preview on the canvas, Ask starts closed", () => {
  it("the hover preview is gone from CanvasNode", () => {
    // What this guards is the preview that used to open on hover, not the
    // existence of a pointer handler. Hovering may still show drag handles.
    expect(CANVAS_SRC).not.toContain("setExpanded");
    expect(CANVAS_SRC).not.toContain("touchToggleRef");
    expect(CANVAS_SRC).not.toMatch(/\bexpanded\b/);
    const hoverUses = CANVAS_SRC.match(/\bhovered\b/g) ?? [];
    expect(hoverUses.length).toBeGreaterThan(0);
    // Hover still feeds the drag handles; how that line is written is free.
    expect(CANVAS_SRC).toMatch(/const showHandles\s*=[^;]*\bhovered\b/);
  });

  it("the drag click suppression survives", () => {
    expect(CANVAS_SRC).toContain("suppressClickRef");
  });

  it("Ask no longer opens itself at desktop widths", () => {
    expect(PAGE_SRC).not.toContain("window.innerWidth >= 1100");
  });

  it("openPeek still opens the rail for a document", () => {
    expect(PAGE_SRC).toContain('if (rail === "closed") setRail("open")');
  });
});
