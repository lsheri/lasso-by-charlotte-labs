import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");

/** styles.css minus the .dark blocks, which stay on the old palette for now. */
function withoutDarkBlocks(css: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < css.length) {
    const start = css.indexOf(".dark {", i);
    if (start === -1) {
      out.push(css.slice(i));
      break;
    }
    out.push(css.slice(i, start));
    const end = css.indexOf("\n}", start);
    i = end === -1 ? css.length : end + 2;
  }
  return out.join("");
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("notebook token swap", () => {
  it("declares the notebook action pair", () => {
    expect(styles).toContain("--nb-green: #12653d");
    expect(styles).toContain("--primary: var(--nb-green)");
    expect(styles).toContain("--primary-foreground: var(--nb-white)");
    expect(styles).toContain("--nb-white: #ffffff");
  });

  it("leaves no old palette literals in src outside the dark blocks", () => {
    const stale = /2bd97b|e8f24c|faf8f2/i;
    const offenders = sourceFiles("src")
      .filter((path) => /\.(ts|tsx|css)$/.test(path))
      .filter((path) => !path.endsWith("pass83-tokens.test.ts"))
      .filter((path) => {
        const text = path.endsWith("styles.css")
          ? withoutDarkBlocks(readFileSync(path, "utf8"))
          : readFileSync(path, "utf8");
        return stale.test(text);
      });
    expect(offenders).toEqual([]);
  });
});
