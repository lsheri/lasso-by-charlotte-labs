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
    expect(resolveMotion("context.picked", false).className).toBe("canvas-lab-context-flare");
    expect(resolveMotion("context.picked", true).className).toBe("");
    expect(resolveMotion("context.picked", true).reduced).toContain("steady context ring");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*canvas-lab-card-paper::before/);
  });

  it("keeps the ring still, rotates only its beam, and declares both mask syntaxes", () => {
    const ring = css.slice(css.indexOf(".canvas-lab-flare {"), css.indexOf(".canvas-lab-flare-beam {"));
    const beamAnimation = css.slice(css.indexOf("@keyframes canvas-lab-flare-beam-kf"), css.indexOf("@keyframes canvas-lab-flare-bloom-kf"));
    expect(ring).toContain("-webkit-mask:");
    expect(ring).toContain("-webkit-mask-composite: xor");
    expect(ring).toContain("mask:");
    expect(ring).not.toContain("transform:");
    expect(beamAnimation).toContain("rotate(360deg)");
  });
});