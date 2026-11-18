// 18 Nov 2026, !important policy: reduced-motion and print overrides are correct practice; a rule that must beat an
// inline style or a utility says so in a `beats:` note. Only unexplained !important counts. See docs/design/components.md.
import { describe, expect, it } from "vitest";

import { unjustifiedImportant } from "../design-health";

describe("unexplained !important", () => {
  it("counts a bare !important", () => {
    expect(unjustifiedImportant(".a { color: red !important; width: 2px !important; }")).toBe(2);
  });

  it("does not count reduced-motion or print blocks, even nested in a layer", () => {
    const css = "@layer nb { @media (prefers-reduced-motion: reduce) { .a { animation: none !important; } } }\n@media print { .b { display: none !important; } }";
    expect(unjustifiedImportant(css)).toBe(0);
  });

  it("does not count a rule that names what it beats, and still counts its neighbour", () => {
    const css = ".a { /* beats: inline itemStyle (TourBoard) */ left: 3% !important; top: 2% !important; }\n.b { left: 1px !important; }";
    expect(unjustifiedImportant(css)).toBe(1);
  });

  it("ignores !important inside comments", () => {
    expect(unjustifiedImportant("/* .a { color: red !important; } */ .b { color: blue; }")).toBe(0);
  });

  it("counts inside other media queries", () => {
    expect(unjustifiedImportant("@media (max-width: 639px) { .a { width: 100% !important; } }")).toBe(1);
  });
});
