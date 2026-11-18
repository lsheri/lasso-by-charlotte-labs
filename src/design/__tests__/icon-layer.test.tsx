// @vitest-environment jsdom
// 18 Nov 2026, icon swap layer: every icon comes from src/design/brand/icons.tsx, renders Lucide by default (same svg,
// same lucide class Charlotte's stroke rule reads), passes props and refs through, and a brand's set can replace it.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRef } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SkinContext } from "@/components/skin/use-skin";
import { ICON_SETS, Search, X, type LucideIcon } from "@/design/brand/icons";

afterEach(cleanup);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("icon swap layer", () => {
  it("renders Lucide's own svg by default, with its class, props and ref", () => {
    const ref = createRef<SVGSVGElement>();
    const { container } = render(
      <SkinContext.Provider value="charlotte">
        <Search ref={ref} size={20} className="extra" aria-label="Find" data-testid="icon" />
      </SkinContext.Provider>,
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toMatch(/\blucide\b/);
    expect(svg.getAttribute("class")).toContain("extra");
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("aria-label")).toBe("Find");
    expect(ref.current).toBe(svg);
  });

  it("lets a brand's icon set replace a name, and leaves the others alone", () => {
    const Replacement = ((props: object) => <svg data-replaced="" {...props} />) as unknown as LucideIcon;
    ICON_SETS.lucide.X = Replacement;
    try {
      const { container } = render(
        <SkinContext.Provider value="charlotte">
          <X />
          <Search />
        </SkinContext.Provider>,
      );
      const [first, second] = Array.from(container.querySelectorAll("svg"));
      expect(first!.hasAttribute("data-replaced")).toBe(true);
      expect(second!.getAttribute("class")).toMatch(/\blucide\b/);
    } finally {
      delete ICON_SETS.lucide.X;
    }
  });

  it("is the only place the app imports lucide-react", () => {
    const direct = sourceFiles("src")
      .filter((path) => /\.tsx?$/.test(path) && !path.includes("__tests__") && path !== "src/design/brand/icons.tsx")
      .filter((path) => /from\s+["']lucide-react["']/.test(readFileSync(path, "utf8")));
    expect(direct).toEqual([]);
  });
});
