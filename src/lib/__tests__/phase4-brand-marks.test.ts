// Phase 4 PR1: the brand is all or nothing. Names come from one table, and only BrandLockup may draw the Lasso loop,
// so no surface can show the loop while Charlotte is on.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BRANDS, brandFor } from "@/design/brand/brand";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

const appFiles = sourceFiles("src").filter((path) => /\.tsx?$/.test(path) && !path.includes("__tests__"));

describe("Phase 4 brand table", () => {
  it("names each skin once, and Charlotte's Ask control is her name alone", () => {
    expect(brandFor("lasso")).toMatchObject({ name: "Lasso", wordmark: "LASSO", askLabel: "Ask Lasso" });
    expect(brandFor("charlotte")).toMatchObject({ name: "Charlotte", wordmark: "CHARLOTTE", askLabel: "Charlotte" });
    // 18 Nov brand layer: each brand names its drawn assets, so code never asks which skin it is.
    expect(brandFor("lasso").look).toEqual({ mark: "loop", glyphs: "graphite", kindIcons: "lucide", legacyDefault: true });
    expect(brandFor("charlotte").look).toEqual({ mark: "charlotte", glyphs: "exhibit", kindIcons: "exhibit", legacyDefault: false });
    expect(JSON.stringify(BRANDS.charlotte)).not.toMatch(/lasso/i);
  });
});

describe("Phase 4 marks", () => {
  it("only BrandLockup draws the Lasso loop", () => {
    const readers = appFiles.filter((path) => readFileSync(path, "utf8").includes("<LassoLoopMark"));
    expect(readers).toEqual(["src/components/layout/BrandLockup.tsx"]);
  });

  it("no lockup spells LASSO beside a mark; the wordmark comes from the skin", () => {
    for (const path of ["src/components/marketing/LandingBoard.tsx", "src/components/demo/DemoWorkboardSandbox.tsx"]) {
      expect(readFileSync(path, "utf8")).not.toContain("<span>LASSO</span>");
    }
  });
});
