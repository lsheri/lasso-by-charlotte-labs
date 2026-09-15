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
  it("hover-expand machinery is gone from CanvasNode", () => {
    expect(CANVAS_SRC).not.toContain("onPointerEnter");
    expect(CANVAS_SRC).not.toContain("setExpanded");
    expect(CANVAS_SRC).not.toContain("touchToggleRef");
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
