// COLOR-1: Ask's green is the landing lime (--ask-live), acid stays the highlight colour.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const tokens = read("src/design/tokens.css");
const styles = read("src/styles.css");
const foot = read("src/components/reflect/AskThinkingFoot.tsx");
const rule = (needle: string) => styles.split("\n").filter((line) => line.includes(needle)).join("\n");

describe("COLOR-1 Ask lime, acid elsewhere", () => {
  it("defines Ask lime as the landing green", () => {
    expect(tokens).toMatch(/--ask-live:\s*#04f85b;/);
    expect(styles).toMatch(/--nb-lasso-green:\s*#04f85b;/);
  });

  it("gives the Ask mark loop, open Ask button and Ask halo the lime token", () => {
    expect(rule(".canvas-lab-ask-button .canvas-lab-ask-mark {")).toContain("--nb-lasso-green: var(--ask-live)");
    expect(rule('.canvas-lab-ask-button[aria-pressed="true"] .canvas-lab-ask-mark {')).toContain("--nb-lasso-green: var(--ask-live)");
    const pressed = rule('[data-toolbar-control="ask"][aria-pressed="true"]:hover:not(:disabled) {');
    expect(pressed).toContain("var(--ask-live)");
    expect(pressed).not.toContain("var(--halo-1)");
    expect(rule(".ask-draft-b {")).toContain("var(--ask-live)");
    expect(rule("@keyframes ask-halo")).toContain("var(--ask-live)");
    expect(foot).toContain("background: var(--ask-live)");
  });

  it("keeps acid on selected cards and armed draw tools", () => {
    expect(tokens).toMatch(/--halo-1:#c8ff00;/);
    expect(rule('.canvas-lab-card-paper[data-selected="true"] {')).toContain("var(--halo-1)");
    expect(tokens).toMatch(/--hand-live:var\(--acid-100\);/);
  });
});
