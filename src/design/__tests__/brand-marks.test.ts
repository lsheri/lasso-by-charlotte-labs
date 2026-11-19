import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DRAWINGS, LASSO_ONLY, PLACEMENTS, SWITCHES } from "@/design/brand/brand-marks";

/** App source a person can see: tests, Storybook-only references and archived pages are left out. */
function appFiles(dir = "src"): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "__tests__" || path === "src/design/reference" || path.endsWith("/archive")) return [];
      return appFiles(path);
    }
    return /\.(tsx?|css)$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = appFiles().map((path) => ({ path, src: readFileSync(path, "utf8") }));
const drawings = new Set<string>(Object.keys(DRAWINGS));
const REGISTRY = "src/design/brand/brand-marks.ts";

/** Signs that a file draws a brand mark itself rather than rendering a switch. */
const DRAWS_A_MARK: [string, RegExp][] = [
  ["the Lasso loop's path", /M20 6c|M29 20l7 7/],
  ["Charlotte's mark geometry", /from "(\.\/|@\/design\/brand\/)charlotte-mark"/],
  ["a mascot or logo image", /assets\/(lasso-mascots|lasso-spider|coach-lasso-spider)/],
  ["the loop's drawing helpers", /import \{(?![^}]*\bLOOP_SIZE_\w+\s*\})[^}]*\} from "@\/lib\/lasso-loop"/],
  ["a brand-mark tag", /data-brand-mark=/],
];

describe("brand marks are registered and tagged (Liam, 15 Nov: logo placements tagged so a switch is easy)", () => {
  it("only the registered drawings draw a brand mark", () => {
    const strays = files.flatMap(({ path, src }) =>
      drawings.has(path) || path === REGISTRY ? [] : DRAWS_A_MARK.filter(([, sign]) => sign.test(src)).map(([what]) => `${path}: ${what}`),
    );
    // Render BrandMark, BrandLockup, LassoThinkingMark or AskLiveMark instead, or register the file in brand-marks.ts.
    expect(strays).toEqual([]);
  });

  it("every registered drawing exists and tags what it draws", () => {
    for (const path of drawings) {
      expect(existsSync(path), path).toBe(true);
      expect(readFileSync(path, "utf8"), path).toMatch(/data-brand-mark="(lasso|charlotte|slate-spool)"/);
    }
  });

  it("each switch exists and picks the mark from the brand's assets, never from a skin's name", () => {
    for (const [name, path] of Object.entries(SWITCHES)) {
      const src = readFileSync(path, "utf8");
      expect(src, path).toMatch(new RegExp(`export function ${name}\\b`));
      expect(src, path).toMatch(/useBrand\(\)\.look\.|\blook\.(mark|glyphs|kindIcons)\b/);
      expect(src, path).not.toMatch(/(useSkin\(\)|\bskin)\s*[!=]==?\s*["'](charlotte|lasso)["']/);
    }
  });

  it("Lasso-only drawings are imported only by their switch", () => {
    for (const [name, allowed] of Object.entries(LASSO_ONLY)) {
      const importers = files
        .filter(({ path, src }) => !path.endsWith(`/${name}.tsx`) && new RegExp(`import \\{[^}]*\\b${name}\\b`).test(src))
        .map(({ path }) => path);
      expect(importers.filter((path) => !(allowed as readonly string[]).includes(path)), name).toEqual([]);
    }
  });

  it("every placement is listed under its kind, and every listed placement still renders it", () => {
    for (const [kind, { component, files: listed }] of Object.entries(PLACEMENTS)) {
      const rendering = files
        .filter(({ path, src }) => path.endsWith(".tsx") && new RegExp(`<${component}\\b`).test(src))
        .map(({ path }) => path)
        .sort();
      // A new placement: add it to PLACEMENTS in brand-marks.ts under the right kind.
      expect(rendering, kind).toEqual([...listed].sort());
    }
  });

  it("the board menu titles itself with the lockup, not the name as plain text (Liam, 15 Nov)", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const drawer = page.slice(page.indexOf('aria-label="Close workboard menu"') - 400, page.indexOf('aria-label="Close workboard menu"'));
    expect(drawer).toContain('<BrandLockup size="sm" />');
    expect(drawer).not.toContain('copy("Lasso")');
  });
});
