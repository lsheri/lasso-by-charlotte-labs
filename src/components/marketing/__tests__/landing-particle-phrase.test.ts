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

  it("appears in ink, turns neon orange, and holds orange for five seconds", () => {
    expect(particle).toContain("export const PARTICLE_TEXT_HOLD_MS = 5000");
    expect(particle).toContain("export const PARTICLE_TEXT_CYCLE_MS = 7600");
    expect(styles).toContain("@keyframes landing-particle-ink-to-orange");
    expect(styles).toContain("animation: landing-particle-ink-to-orange 7.6s ease-in-out infinite");
    expect(styles).toContain("color: var(--nb-ink)");
    expect(styles).toContain("color: var(--lb-neon-orange)");
  });

  it("keeps the phrase underlined with the moving colour", () => {
    expect(styles).toContain("text-decoration-color: currentColor");
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

  it("answers reduced motion with the settled orange state", () => {
    const reduced = styles.slice(styles.indexOf("landing-particle-word-text { opacity: 1 !important"));
    expect(reduced).toContain("animation: none");
    expect(reduced).toContain("color: var(--lb-neon-orange)");
ed  });
});
