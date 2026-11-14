// @vitest-environment jsdom
// Phase 3 PR4: GraphiteIcon draws the Charlotte set only under the Charlotte skin; Lasso renders exactly as before.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TAB_ITEMS } from "@/components/layout/nav-config";
import { GraphiteIcon, ICON_NAMES } from "@/components/notebook/icons";
import { SkinContext } from "@/components/skin/use-skin";
import { CHARLOTTE_GLYPHS } from "@/design/icons/charlotte";

function paths(container: HTMLElement) {
  return [...container.querySelectorAll("path")].map((p) => p.getAttribute("d"));
}

describe("GraphiteIcon by skin", () => {
  it("renders the same Lasso SVG with no provider and with the Lasso skin", () => {
    for (const name of ICON_NAMES) {
      const bare = render(<GraphiteIcon name={name} />).container.innerHTML;
      const lasso = render(
        <SkinContext.Provider value="lasso">
          <GraphiteIcon name={name} />
        </SkinContext.Provider>,
      ).container.innerHTML;
      expect(lasso, name).toBe(bare);
      expect(bare, name).toContain('stroke-width="1.75"');
    }
  });

  it("draws every Charlotte glyph at stroke 1.5 with no motion attributes", () => {
    for (const name of ICON_NAMES) {
      const { container } = render(
        <SkinContext.Provider value="charlotte">
          <GraphiteIcon name={name} animate playOnMount />
        </SkinContext.Provider>,
      );
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("stroke-width"), name).toBe("1.5");
      expect(svg.getAttribute("data-icon")).toBe(name);
      expect(svg.classList.contains("nb-ico")).toBe(true);
      expect(svg.hasAttribute("data-anim") || svg.hasAttribute("data-play")).toBe(false);
      expect(paths(container)).toEqual(
        CHARLOTTE_GLYPHS[name].map((p) => (typeof p === "string" ? p : p.d)),
      );
    }
  });

  it("draws the dashed section outline dashed, without pathLength", () => {
    const { container } = render(
      <SkinContext.Provider value="charlotte">
        <GraphiteIcon name="section" />
      </SkinContext.Provider>,
    );
    const [outline, label] = container.querySelectorAll("path");
    expect(outline?.getAttribute("stroke-dasharray")).toBe("2.1 1.9");
    expect(outline?.hasAttribute("pathLength")).toBe(false);
    expect(label?.getAttribute("pathLength")).toBe("1");
  });

  it("gives the mobile More tab its own glyph, in both skins (G7)", () => {
    expect(TAB_ITEMS.more.icon).toBe("more");
  });
});
