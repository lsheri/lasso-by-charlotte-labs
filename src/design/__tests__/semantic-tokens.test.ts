// PR0: job-named tokens exist with today's values, in both scopes, and nothing reads them yet.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const tokens = readFileSync("src/design/tokens.css", "utf8");

const JOBS: Record<string, string> = {
  "--state-on-record": "var(--nb-green)",
  "--wrap-mark": "var(--nb-green)",
  "--selection": "var(--nb-green-wash)",
  "--live": "var(--nb-lasso-green)",
  "--icon-ink": "currentColor",
  "--icon-ink-active": "var(--nb-ink)",
};

function jobBlock(): string {
  const start = tokens.indexOf(':root,\n[data-lasso="on"] {');
  expect(start).toBeGreaterThan(-1);
  return tokens.slice(start, tokens.indexOf("\n}", start));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("job-named tokens", () => {
  it("declares every job on :root and the app shell, so remapped hues resolve in each scope", () => {
    const block = jobBlock();
    for (const [name, value] of Object.entries(JOBS)) {
      expect(block).toContain(`${name}:${value};`);
    }
  });

  it("leaves the existing --focus-ring alone", () => {
    expect(tokens.match(/--focus-ring:/g)).toHaveLength(1);
    expect(tokens).toContain("--focus-ring:var(--focus-ring-new);");
  });

  it("is read by nothing yet, so the app renders exactly as before", () => {
    const readers = sourceFiles("src")
      .filter(
        (path) =>
          /\.(css|tsx?)$/.test(path) && !path.includes("__tests__") && !path.endsWith("tokens.css"),
      )
      .filter((path) => {
        const text = readFileSync(path, "utf8");
        return Object.keys(JOBS).some((name) => new RegExp(`var\\(${name}[,)]`).test(text));
      });
    expect(readers).toEqual([]);
  });
});
