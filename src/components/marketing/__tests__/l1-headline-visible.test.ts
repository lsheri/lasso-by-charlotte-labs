// Guard: the hero headline words may drop below full opacity ONLY inside
// the one particle run the component is driving. The stylesheet never hides
// them, and every exit path (completion, stop, cleanup, reduced motion)
// restores opacity 1, so a stopped, throttled or failed run can never leave
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
  it("runs once: there is no repeating cycle", () => {
    expect(particle).not.toMatch(/%\s*[A-Z_]*CYCLE/);
    expect(particle).not.toMatch(/CYCLE_MS/);
    expect(particle).not.toMatch(/setInterval/);
  });

  it("never writes a hard sub-1 opacity literal; below 1 is always eased", () => {
    const writes = [...particle.matchAll(/style\.opacity\s*=\s*([^;]+);/g)].map((m) => m[1]!.trim());
    expect(writes.length).toBeGreaterThan(0);
    for (const value of writes) {
      if (value === '"1"') continue;
      expect(value).not.toMatch(/^["'][0-9.]+["']$/);
      expect(value).toMatch(/ease\w*\(/);
    }
  });

  it("the reduced-motion path sets opacity 1", () => {
    const i = particle.indexOf("if (reducedMotion.matches) {");
    expect(i).toBeGreaterThan(-1);
    expect(particle.slice(i, i + 120)).toContain('style.opacity = "1"');
  });

  it("the stop/cleanup path sets opacity 1 and is called on cleanup", () => {
    const body = particle.slice(particle.indexOf("const finish = () =>"), particle.indexOf("const draw ="));
    expect(body).toContain('style.opacity = "1"');
    expect(body).toContain("cancelAnimationFrame");
    expect(body).toContain("clearRect");
    expect(particle).toMatch(/return \(\) => \{\s*finish\(\);/);
  });

  it("the run-completion path sets opacity 1 and schedules no further frame", () => {
    expect(particle).toMatch(/progress >= 1[^{]*\{\s*finish\(\);\s*return;/);
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
