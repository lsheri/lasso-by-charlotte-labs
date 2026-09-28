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

  it("runs the hide, particle-form, reveal cycle on a canvas", () => {
    expect(particle).toContain("export const PARTICLE_TEXT_HOLD_MS = 3000");
    expect(particle).toContain("export const PARTICLE_TEXT_CYCLE_MS = 8500");
    expect(particle).toContain("canvas");
    expect(particle).toContain("strokeText");
    // The word is hidden while particles gather, revealed for the hold,
    // and faded as they disperse.
    expect(particle).toMatch(/if \(gathering\) \{\s*wordNode\.style\.opacity = "0"/);
    expect(particle).toContain("dispersing");
  });

  it("keeps the phrase in ink with the lime green underline", () => {
    expect(styles).toContain("color: var(--nb-ink)");
    expect(styles).toContain("text-decoration-line: underline");
    const baseStart = styles.indexOf(".landing-particle-word-text {");
    const base = styles.slice(baseStart, styles.indexOf("@media (prefers-reduced-motion: reduce)", baseStart));
    expect(base).toContain("text-decoration-color: var(--nb-lasso-green)");
    expect(base).toContain("text-decoration-thickness: 0.1em");
  });

  it("makes no network calls and records no events", () => {
    expect(particle).not.toContain("onClick");
    expect(particle).not.toContain("recordAnonymousEventFn");
    expect(particle).not.toContain("emitClientEvent");
  });

  it("answers reduced motion with the words fully visible and no canvas", () => {
    const reduced = styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)"), styles.indexOf("/* Beat loops"));
    expect(reduced).toContain(".landing-particle-word-text { opacity: 1 !important");
    expect(reduced).toContain(".landing-particle-word-canvas { display: none");
    expect(particle).toContain('wordNode.style.opacity = "1"');
  });
});
