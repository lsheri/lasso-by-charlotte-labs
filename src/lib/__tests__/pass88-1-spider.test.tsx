// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("spider mascot beside Ask Lasso", () => {
  const spider = readFileSync("src/components/notebook/SpiderMark.tsx", "utf8");
  const page = readFileSync("src/pages/EngagementPage.tsx", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");

  it("renders one still frame, hidden from assistive tech, and carries no telemetry", () => {
    expect(spider).toContain("lasso-spider-static.png");
    // Pass 103 retired the animated frame: swapping frames read as a flash.
    expect(spider).not.toContain("lasso-spider-spin.gif");
    expect(spider).toContain("nb-spider-wobble");
    expect(spider).toContain('alt=""');
    expect(spider).toContain("draggable={false}");
    expect(spider).not.toContain("logEvent");
    expect(spider).not.toContain("logV2");
  });

  it("holds completely still under reduced motion, after the base rules", () => {
    const base = styles.indexOf(".nb-spider-wobble");
    const reduced = styles.indexOf("@media (prefers-reduced-motion: reduce)", base);
    expect(base).toBeGreaterThan(-1);
    expect(reduced).toBeGreaterThan(base);
    expect(styles.slice(reduced)).toContain(".nb-spider-wobble");
    expect(styles.slice(reduced)).toContain("animation: none !important");
  });

  it("is the Ask Lasso mark on the engagement page, with no Sparkle left", () => {
    expect(page).toContain("<SpiderMark size={18} /> Ask Lasso");
    expect(page).not.toContain("Sparkle");
  });
});
