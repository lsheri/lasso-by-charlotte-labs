import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { contextFlareSequence } from "../canvas-lab-marquee";
import { resolveMotion } from "@/lib/motion-registry";

const css = readFileSync("src/styles.css", "utf8");

describe("C1 board context visibility", () => {
  it("uses only the Lasso lime token for the selected-card ring", () => {
    const start = css.indexOf(".canvas-lab-card-paper::before");
    const end = css.indexOf(".canvas-lab-context-mark", start);
    const rules = css.slice(start, end);
    expect(rules).toContain("var(--nb-lasso-green)");
    expect(rules).not.toContain("var(--mint)");
  });

  it("orders flares top to bottom then left to right, caps them, and limits the last delay", () => {
    const nodes = Array.from({ length: 30 }, (_, index) => ({ id: `n${index}`, x: (29 - index) % 3, y: Math.floor((29 - index) / 3) }));
    const sequence = contextFlareSequence(nodes.map((node) => node.id), nodes);
    expect(sequence).toHaveLength(24);
    expect(sequence.slice(0, 3).map(({ id }) => id)).toEqual(["n27", "n28", "n29"]);
    expect(sequence.at(-1)?.delayMs).toBe(400);
  });

  it("registers context entry with a still reduced-motion answer", () => {
    expect(resolveMotion("context.picked", false).className).toBe("canvas-lab-context-flare");
    expect(resolveMotion("context.picked", true).className).toBe("");
    expect(resolveMotion("context.picked", true).reduced).toContain("steady context ring");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*canvas-lab-context-flare/);
  });
});