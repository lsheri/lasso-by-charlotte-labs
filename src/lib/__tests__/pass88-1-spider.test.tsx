// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readStyles } from "@/design/stylesheet";

describe("spider mascot beside Ask Lasso", () => {
  const page = readFileSync("src/pages/EngagementPage.tsx", "utf8");
  const styles = readStyles();

  it('is gone from the app, with its image and motion (Liam, 15 Nov: "i dont want the spider anymore")', () => {
    expect(existsSync("src/components/notebook/SpiderMark.tsx")).toBe(false);
    expect(existsSync("src/components/notebook/NotebookSpider.tsx")).toBe(false);
    expect(existsSync("src/assets/lasso-spider-static.png")).toBe(false);
    expect(styles).not.toContain("nb-spider");
  });

  it("leaves no Sparkle beside Ask Lasso on the engagement page", () => {
    // The mark itself is no longer placed on this page: Ask Lasso is reached
    // through the dock and the floating button. What survives, and is still
    // worth keeping out, is the old Sparkle glyph.
    expect(page).not.toContain("Sparkle");
    expect(page).toContain("Ask Lasso");
  });
});
