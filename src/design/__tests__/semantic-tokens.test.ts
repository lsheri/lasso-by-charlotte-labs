// PR0 and P2a: job-named tokens exist with today's values, in both scopes, and nothing the app imports reads them yet.
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
  "--state-held": "var(--hand-live)",
  "--state-held-ink": "var(--text-primary)",
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

/** Every "@/design/..." module the app (src/ outside src/design/ and tests) imports. */
function appImports(): Set<string> {
  const specs = new Set<string>();
  for (const path of sourceFiles("src")) {
    if (!/\.tsx?$/.test(path) || path.includes("__tests__") || path.startsWith("src/design/"))
      continue;
    for (const m of readFileSync(path, "utf8").matchAll(/from ["'](@\/design\/[^"']+)["']/g))
      specs.add(m[1] ?? "");
  }
  return specs;
}

const APP_IMPORTED_REFERENCE = new Set(
  [...appImports()]
    .filter((spec) => spec.startsWith("@/design/reference/"))
    .flatMap((spec) => {
      const base = spec.replace("@/", "src/");
      return [`${base}.ts`, `${base}.tsx`];
    }),
);

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

  it("is read only where a Phase 3 PR wires it, with Lasso fallbacks, so Lasso looks exactly as before", () => {
    // Reference components the app imports count as app code; the rest of src/design/ does not.
    const appRead = sourceFiles("src").filter(
      (path) =>
        /\.(css|tsx?)$/.test(path) &&
        !path.includes("__tests__") &&
        (!path.startsWith("src/design/") || APP_IMPORTED_REFERENCE.has(path)),
    );
    const readers = appRead.filter((path) => {
      const text = readFileSync(path, "utf8");
      return Object.keys(JOBS).some((name) => new RegExp(`var\\(${name}[,)]`).test(text));
    });
    // PR3: the sidebar's wrap-up dot reads --wrap-mark, with --nb-green as the fallback, so Lasso is unchanged.
    expect(readers).toEqual(["src/components/layout/SidebarNav.tsx"]);
    const sidebar = readFileSync("src/components/layout/SidebarNav.tsx", "utf8");
    expect(sidebar).toContain('"var(--wrap-mark, var(--nb-green))"');
    for (const name of Object.keys(JOBS).filter((n) => n !== "--wrap-mark"))
      expect(sidebar).not.toMatch(new RegExp(`var\\(${name}[,)]`));
  });

  it("sees the app's real reference imports, so the fence cannot pass on an empty list", () => {
    expect(APP_IMPORTED_REFERENCE.has("src/design/reference/SketchCard.tsx")).toBe(true);
    expect(APP_IMPORTED_REFERENCE.has("src/design/reference/Toolbar.tsx")).toBe(false);
    expect(APP_IMPORTED_REFERENCE.has("src/design/reference/NavRow.tsx")).toBe(false);
  });

  it("keeps skins out of the app until each one ships", () => {
    expect([...appImports()].filter((spec) => spec.startsWith("@/design/skins/"))).toEqual([]);
  });
});
