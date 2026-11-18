// G6 (17 Nov 2026): a card in Ask's context is lime (1.44:1 on page, below WCAG 1.4.11's 3:1),
// so it must keep a second cue: the paperclip, a navy icon on the lime disc.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");
const charlotte = readFileSync("src/design/skins/charlotte.css", "utf8");
const labCard = readFileSync("src/components/canvas-lab/LabCard.tsx", "utf8");

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const hex = (name: string) => new RegExp(`--${name}:(#[0-9a-fA-F]{6});`).exec(charlotte)?.[1] ?? "";

describe("G6: the in-context card keeps a non-colour cue", () => {
  it("renders the paperclip on every card in context", () => {
    expect(labCard).toMatch(/selected \? <Paperclip[^>]*className="canvas-lab-context-mark"/);
  });

  it("draws the paperclip in --text-on-acid on the --ask-live disc", () => {
    expect(css).toMatch(
      /\.canvas-lab-context-mark \{[^}]*background: var\(--ask-live\);[^}]*color: var\(--text-on-acid\);/s,
    );
  });

  it("keeps the Charlotte paperclip at 3:1 or better against its disc", () => {
    expect(charlotte).toContain("--text-on-acid:var(--ch-navy);");
    expect(charlotte).toContain("--ask-live:var(--ch-lime);");
    expect(contrast(hex("ch-navy"), hex("ch-lime"))).toBeGreaterThanOrEqual(3);
  });
});
