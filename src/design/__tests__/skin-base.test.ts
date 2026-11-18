// G2 part 3 (17 Nov 2026): a skin sets six type hues and its surfaces; skin-base.css derives the category colours.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const base = readFileSync("src/design/skins/skin-base.css", "utf8");
const skins = readdirSync("src/design/skins").filter(
  (f) => f.endsWith(".css") && f !== "skin-base.css",
);
const HUES = ["--t-talk", "--t-words", "--t-numbers", "--t-slides", "--t-visual", "--t-code"];

describe("skin base", () => {
  it("applies to any skin and never to Lasso, which sets no data-skin", () => {
    expect(base).toMatch(/^\[data-skin\] \[data-lasso="on"\],$/m);
    expect(base).not.toMatch(/\[data-skin="/);
  });

  it("uses only generic tokens, so it works for any skin", () => {
    expect(base).not.toMatch(/--ch-/);
  });

  it("is loaded before the skins, so a skin can still override a derived colour", () => {
    const styles = readFileSync("src/styles.css", "utf8");
    expect(styles.indexOf("skins/skin-base.css")).toBeGreaterThan(-1);
    expect(styles.indexOf("skins/skin-base.css")).toBeLessThan(
      styles.indexOf("skins/charlotte.css"),
    );
  });

  it("gets all six type hues from every skin", () => {
    for (const hue of HUES) expect(base, hue).toContain(`var(${hue})`);
    for (const file of skins) {
      const css = readFileSync(`src/design/skins/${file}`, "utf8");
      for (const hue of HUES)
        expect(css, `${file} ${hue}`).toMatch(new RegExp(`${hue}:#[0-9a-fA-F]{6};`));
    }
  });
});
