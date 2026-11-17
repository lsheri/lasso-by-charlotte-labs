// C1 part 3 (17 Nov 2026): --nb-green reads with a clear job read a job token first, keeping --nb-green as the fallback.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");
const tokens = readFileSync("src/design/tokens.css", "utf8");

const reads = (job: string) =>
  css.match(new RegExp(`var\\(--${job}, var\\(--nb-green\\)\\)`, "g"))?.length ?? 0;

describe("C1 part 3 job tokens", () => {
  it("declares each new job as --nb-green, so nothing moves on screen", () => {
    for (const job of ["active-mark", "drop-target", "handle", "ai-voice"]) {
      expect(tokens, job).toContain(`--${job}:var(--nb-green);`);
    }
  });

  it("moves the reads whose job is clear", () => {
    expect(reads("active-mark")).toBe(5);
    expect(reads("drop-target")).toBe(7);
    expect(reads("handle")).toBe(5);
    expect(reads("ai-voice")).toBe(2);
  });

  it("gives selected colour blocks the same ring as every other selected object", () => {
    expect(css).toMatch(
      /\.canvas-lab-colour-block\[data-selected="true"\]\s*\{[^}]*var\(--select-ring, var\(--nb-green\)\)/,
    );
  });
});
