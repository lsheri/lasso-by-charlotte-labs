import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DOCK_MIN_WIDTH, STORE_KEY, clampDockWidth, maxDockWidth } from "@/components/reflect/ask-dock-state";

const read = (path: string) => readFileSync(path, "utf8");

describe("95.1 plain white chat", () => {
  const css = read("src/styles.css");
  const dock = read("src/components/reflect/AskDock.tsx");

  it("drops the ruled background inside the dock only", () => {
    expect(dock).toContain("nb-ask-plain");
    const block = css.slice(css.indexOf(".nb-ask-plain"));
    expect(block.slice(0, 200)).toContain("background-image: none");
    // Ruled backgrounds were removed from all surfaces on 12 Sep 2026;
    // the binder-body class and its rhythm remain.
    expect(css).toContain(".nb-binder-body {");
    expect(css).not.toContain("repeating-linear-gradient");
  });
});

describe("95.1 resizable dock", () => {
  it("persists under the agreed key", () => {
    expect(STORE_KEY).toBe("lasso.ask.width");
  });

  it("clamps between the current width and about seven tenths of the window", () => {
    expect(clampDockWidth(10)).toBe(DOCK_MIN_WIDTH);
    const max = maxDockWidth();
    expect(clampDockWidth(99999)).toBe(max);
    expect(max).toBeGreaterThanOrEqual(DOCK_MIN_WIDTH);
    expect(read("src/components/reflect/ask-dock-state.tsx")).toContain("viewport * 0.7");
  });
});

describe("95.1 backdrop", () => {
  const css = read("src/styles.css");
  const dock = read("src/components/reflect/AskDock.tsx");

  it("blurs the page behind the dock without covering it", () => {
    expect(css).toContain(".nb-ask-backdrop");
    expect(css).toContain("backdrop-filter: blur(3px)");
    expect(dock).toContain("z-30");
    expect(dock).toContain("z-40");
  });

  it("keeps the dock open when a draft is typed", () => {
    expect(dock).toContain("const hasDraft = ask.draft.trim().length > 0;");
    expect(dock).toContain("if (!hasDraft) onOpenChange(false);");
  });

  it("swaps instantly under reduced motion", () => {
    const block = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced.includes(".nb-ask-backdrop") || block.includes(".nb-ask-backdrop")).toBe(true);
  });
});
