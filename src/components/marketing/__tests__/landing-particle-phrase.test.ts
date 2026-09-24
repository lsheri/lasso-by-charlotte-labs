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

  it("loops through a two-second resolved hold and a reduced-motion fallback", () => {
    expect(particle).toContain("export const PARTICLE_TEXT_HOLD_MS = 2000");
    expect(particle).toContain("const CYCLE_MS = 6000");
    expect(particle).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("adds no action or event", () => {
    expect(particle).not.toContain("onClick");
    expect(particle).not.toContain("recordAnonymousEventFn");
    expect(particle).not.toContain("emitClientEvent");
  });
});