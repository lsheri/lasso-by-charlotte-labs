// T1 (17 Nov 2026): the type scale is option B, seven steps from an 11px floor.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/design/tokens.css", "utf8");

function typeSteps(): Array<[string, number]> {
  return [...css.matchAll(/(--type-[a-z]+)\s*:\s*([0-9.]+)px;/g)].map((m) => [
    m[1] ?? "",
    Number(m[2]),
  ]);
}

describe("type scale", () => {
  it("has exactly the seven option B steps, in order", () => {
    expect(typeSteps()).toEqual([
      ["--type-label", 11],
      ["--type-small", 12],
      ["--type-body", 13],
      ["--type-control", 14],
      ["--type-lead", 16],
      ["--type-title", 20],
      ["--type-display", 28],
    ]);
  });

  it("never goes below the 11px floor", () => {
    for (const [name, px] of typeSteps()) expect(px, name).toBeGreaterThanOrEqual(11);
  });

  it("does not define Tailwind's own --text-* sizes", () => {
    expect(css).not.toMatch(/--text-(xs|sm|base|lg|xl|2xl|3xl)\s*:/);
  });
});
