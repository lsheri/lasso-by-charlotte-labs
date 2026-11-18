import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { openOneRoot, withOneRootOpen } from "@/lib/sidebar-tree-state";
import { readStyles } from "@/design/stylesheet";

// Liam, 15 Nov: only one top-level folder open at a time, rolling open and shut, and a simpler tree.
const roots = [
  { id: "a", descendants: ["a1", "a2"] },
  { id: "b", descendants: ["b1"] },
  { id: "c", descendants: [] },
];

describe("one top-level folder open at a time", () => {
  it("opening a root closes every other root and everything inside them", () => {
    expect(openOneRoot([], roots, "b").sort()).toEqual(["a", "a1", "a2", "c"]);
  });

  it("keeps the opened root's own nested choices", () => {
    expect(openOneRoot(["a", "a1", "a2", "b", "b1", "c"], roots, "b").sort()).toEqual(["a", "a1", "a2", "b1", "c"]);
    expect(openOneRoot(["a", "a1", "a2", "b", "c"], roots, "b")).not.toContain("b1");
  });

  it("shows one root when saved choices left several open, preferring the active board's root", () => {
    expect(withOneRootOpen([], roots, "c").sort()).toEqual(["a", "a1", "a2", "b", "b1"]);
    expect(withOneRootOpen(["c"], roots, undefined).sort()).toEqual(["b", "b1", "c"]);
    expect(withOneRootOpen(["a", "b", "c"], roots, undefined)).toEqual(["a", "b", "c"]);
  });

  it("drops Expand all, rolls folders through RollDown, and honours reduced motion", () => {
    const nav = readFileSync("src/components/layout/SidebarNav.tsx", "utf8");
    const styles = readStyles();
    expect(nav).not.toContain("Expand all");
    expect(nav).toContain("<RollDown open={!collapsed}>");
    expect(styles).toMatch(/\.nb-roll\s*{[^}]*grid-template-rows: 0fr/);
    expect(styles).toMatch(/prefers-reduced-motion: reduce\)\s*{\s*\.nb-roll, \.nb-roll-chevron { transition: none; }/);
  });
});
