// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("spider mascot beside Ask Lasso", () => {
  const spider = readFileSync("src/components/notebook/SpiderMark.tsx", "utf8");
  const page = readFileSync("src/pages/EngagementPage.tsx", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");

  it("renders both frames, hidden from assistive tech, and carries no telemetry", () => {
    expect(spider).toContain("lasso-spider-spin.gif");
    expect(spider).toContain("lasso-spider-static.png");
    expect(spider).toContain("nb-spider-anim");
    expect(spider).toContain("nb-spider-static");
    expect(spider).toContain('alt: ""');
    expect(spider).toContain("draggable: false");
    expect(spider).not.toContain("logEvent");
    expect(spider).not.toContain("logV2");
  });

  it("swaps to the static frame under reduced motion, after the base rules", () => {
    const base = styles.indexOf(".nb-spider-anim");
    const reduced = styles.lastIndexOf("@media (prefers-reduced-motion: reduce)");
    expect(base).toBeGreaterThan(-1);
    expect(reduced).toBeGreaterThan(base);
    expect(styles.slice(reduced)).toContain(".nb-spider-static");
  });

  it("is the Ask Lasso mark on the engagement page, with no Sparkle left", () => {
    expect(page).toContain("<SpiderMark size={18} /> Ask Lasso");
    expect(page).not.toContain("Sparkle");
  });
});
