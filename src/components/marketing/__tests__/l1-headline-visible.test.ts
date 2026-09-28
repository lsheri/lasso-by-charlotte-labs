// Guard: the hero headline words must be readable whether or not the
// particle animation runs. The animation may only draw on top of them.
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
  it("the animation never writes an opacity other than 1 onto a word", () => {
    const writes = [...particle.matchAll(/style\.opacity\s*=\s*([^;]+);/g)].map((m) => m[1]!.trim());
    for (const value of writes) expect(value).toBe('"1"');
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
