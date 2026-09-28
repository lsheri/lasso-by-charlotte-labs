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
    expect(particle).toContain("export const PARTICLE_CYCLE_MS = 5000");
    expect(particle).toContain("export const PARTICLE_GATHER_MS = 2200");
    expect(particle).toContain("const PARTICLE_HOLD_END_MS = 4000");
    expect(particle).toContain("canvas");
    expect(particle).toContain("strokeText");
    // The word eases up during gather and down during disperse. Every sub-1
    // opacity write is an eased value, never a hard literal cut.
    const writes = [...particle.matchAll(/style\.opacity\s*=\s*([^;]+);/g)].map((m) => m[1]!.trim());
    expect(writes.some((value) => /ease\w*\(/.test(value))).toBe(true);
    expect(writes.filter((value) => value !== '"1"').every((value) => /ease\w*\(/.test(value))).toBe(true);
    expect(particle).toContain("disperseProgress");
    expect(particle).toMatch(/particle\.endX\s*-\s*particle\.x/);
    expect(particle).toMatch(/particle\.endY\s*-\s*particle\.y/);
    expect(particle).not.toMatch(/else\s*\{\s*wordNode\.style\.opacity\s*=\s*["'][0-9.]+["']/s);
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

  it("pauses offscreen and restarts every word from one shared timestamp", () => {
    expect(particle).toContain("setStartAt(isIntersecting ? performance.now() : null)");
    expect(particle).toContain("startAt={startAt}");
    expect(particle).toContain("data-particle-start={startAt ?? undefined}");
  });
});
