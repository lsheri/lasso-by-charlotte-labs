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
    expect(sequence.slice(0, 3).map(({ id }) => id)).toEqual(["n29", "n28", "n27"]);
    expect(sequence.at(-1)?.delayMs).toBe(400);
  });

  it("registers context entry with a still reduced-motion answer", () => {
    expect(resolveMotion("context.picked", false).className).toBe("canvas-lab-context-corona-motion");
    expect(resolveMotion("context.picked", true).className).toBe("");
    expect(resolveMotion("context.picked", true).reduced).toBe("A still lime glow; nothing moves");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*canvas-lab-card-paper::before/);
  });

  it("masks a still band while rotation lives on its inner flame squares", () => {
    const band = css.slice(css.indexOf(".canvas-lab-corona-band {"), css.indexOf(".canvas-lab-corona-flame {"));
    expect(band).toContain("-webkit-mask:");
    expect(band).toContain("-webkit-mask-composite: xor");
    expect(band).toContain("mask:");
    expect(band).toContain("mask-composite: exclude");
    expect(band).not.toContain("rotate(");
    expect(css).toContain(".canvas-lab-context-corona-motion .canvas-lab-corona-flame-a");
    expect(css).toContain("canvas-lab-corona-clockwise");
    expect(css).toContain("canvas-lab-corona-counterclockwise");
  });

  it("pauses during board interaction and has a reduced-motion block", () => {
    expect(css).toContain('.canvas-lab-surface[data-interacting="true"] .canvas-lab-context-corona');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.canvas-lab-context-corona/);
  });
});