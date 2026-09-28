// Guard: the hero headline words may be hidden ONLY by the running particle
// loop while it gathers or disperses. The stylesheet never hides them, and
// every exit path (stop, reduced motion, observer offscreen) restores
// opacity 1, so a stopped, throttled or failed animation can never leave
// the headline unreadable.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const particle = readFileSync("src/components/marketing/LandingParticlePhrase.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

function rulesFor(selectorFragment: string) {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(styles))) {
    if (m[1]!.includes(selectorFragment)) out.push(m[2]!);
  }
  return out;
}

describe("L1 hero headline stays visible", () => {
  it("hides a word only inside the running gather/disperse phases", () => {
    const writes = [...particle.matchAll(/style\.opacity\s*=\s*([^;]+);/g)].map((m) => m[1]!.trim());
    // Allowed writes: full reveal, the gather hide, and the disperse fade.
    for (const value of writes) {
      expect(['"1"', '"0"', "String(1 - easeOutCubic((elapsed - HOLD_END_MS) / (DISPERSE_END_MS - HOLD_END_MS)))"]).toContain(value);
    }
    // The hide must be gated on the gathering phase of the running loop.
    expect(particle).toMatch(/if \(gathering\) \{\s*wordNode\.style\.opacity = "0"/);
  });

  it("restores full visibility on stop and on reduced motion", () => {
    const stopBody = particle.slice(particle.indexOf("const stop = () =>"), particle.indexOf("const onMotionChange"));
    expect(stopBody).toContain('wordNode.style.opacity = "1"');
    expect(stopBody).toContain("clearRect");
    expect(particle).toContain("reducedMotion.matches");
  });

  it("the animation never hides a word by visibility, display or clip", () => {
    expect(particle).not.toMatch(/wordNode\.style\.(visibility|display|clipPath|clip)\s*=/);
  });

  it("no stylesheet rule gives the word text a hidden resting state", () => {
    for (const body of [...rulesFor("landing-particle-word-text"), ...rulesFor("landing-particle-word "), ...rulesFor("landing-particle-phrase")]) {
      expect(body).not.toMatch(/opacity\s*:\s*0(\.0*)?\s*(;|!|$)/);
      expect(body).not.toMatch(/visibility\s*:\s*hidden/);
      expect(body).not.toMatch(/display\s*:\s*none/);
    }
  });
});
