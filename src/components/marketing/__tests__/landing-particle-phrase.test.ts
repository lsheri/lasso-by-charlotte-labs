import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const particle = readFileSync("src/components/marketing/LandingParticlePhrase.tsx", "utf8");
const landing = readFileSync("src/components/marketing/B2BLanding.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

describe("landing headline particle phrase", () => {
  it("replaces the highlighter without changing the headline copy", () => {
    expect(landing).toContain('<LandingParticlePhrase text="The human judgment, process, and thinking" />');
    expect(landing).not.toContain("landing-hero-highlight");
    expect(styles).not.toContain("landing-hero-highlight");
  });

  it("loops through a seven-second resolved hold and a reduced-motion fallback", () => {
    expect(particle).toContain("export const PARTICLE_TEXT_HOLD_MS = 7000");
    expect(particle).toContain("const CYCLE_MS = 12500");
    expect(particle).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps the resolved phrase underlined in Lasso green", () => {
    expect(styles).toContain("text-decoration-color: var(--nb-lasso-green)");
    expect(styles).toContain("text-decoration-line: underline");
  });

  it("holds the green particles around the full letter outlines while the phrase is visible", () => {
    expect(particle).toContain('sampleContext.strokeText(word, 0, baseline)');
    expect(particle).toContain("if (gathering || holding || dispersing)");
    expect(particle).toContain("const local = holding ? 0");
    expect(particle).toContain("holding\n              ? holdPulse");
  });

  it("adds no action or event", () => {
    expect(particle).not.toContain("onClick");
    expect(particle).not.toContain("recordAnonymousEventFn");
    expect(particle).not.toContain("emitClientEvent");
  });
});