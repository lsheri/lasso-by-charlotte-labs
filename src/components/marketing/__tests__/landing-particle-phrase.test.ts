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

  it("sits in static ink with a bold lime green underline and no loop", () => {
    expect(particle).toContain("export const PARTICLE_TEXT_HOLD_MS = 5000");
    expect(particle).toContain("export const PARTICLE_TEXT_CYCLE_MS = 7600");
    expect(styles).toContain("color: var(--nb-ink)");
    const baseStart = styles.indexOf(".landing-particle-word-text {");
    const base = styles.slice(baseStart, styles.indexOf("@media (prefers-reduced-motion: reduce)", baseStart));
    expect(base).toContain("text-decoration-color: var(--nb-lasso-green)");
    expect(base).toContain("text-decoration-thickness: 0.1em");
    expect(base).not.toContain("animation: landing-particle-ink-to-orange");
  });

  it("keeps the phrase underlined with the lime green line", () => {
    expect(styles).toContain("text-decoration-line: underline");
  });

  it("renders plain spans with no canvas, particles, or network calls", () => {
    expect(particle).not.toContain("canvas");
    expect(particle).not.toContain("strokeText");
    expect(particle).not.toContain("useEffect");
    expect(particle).not.toContain("onClick");
    expect(particle).not.toContain("recordAnonymousEventFn");
    expect(particle).not.toContain("emitClientEvent");
  });

  it("answers reduced motion with the same static ink state", () => {
    const reduced = styles.slice(styles.indexOf("landing-particle-word-text { opacity: 1 !important"), styles.indexOf("/* Beat loops"));
    expect(reduced).toContain("animation: none");
    expect(reduced).not.toContain("var(--lb-neon-orange)");
  });
});
