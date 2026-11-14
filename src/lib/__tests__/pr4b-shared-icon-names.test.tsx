// @vitest-environment jsdom
// Phase 3 PR4b: the 10 names Charlotte drew first become shared GraphiteIcon names, each with a hand-drawn Lasso path.
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GraphiteIcon, getIconSignature, type GraphiteIconName } from "@/components/notebook/icons";
import { SkinContext } from "@/components/skin/use-skin";
import { CHARLOTTE_EXTRA_GLYPHS, CHARLOTTE_EXTRA_NAMES } from "@/design/icons/charlotte-extra";

const styles = readFileSync("src/styles.css", "utf8");

function lassoPaths(name: GraphiteIconName) {
  const { container } = render(<GraphiteIcon name={name} />);
  return { svg: container.querySelector("svg")!, paths: [...container.querySelectorAll("path")] };
}

describe("PR4b shared icon names", () => {
  it("draws each new name in Lasso at stroke 1.75 with the draw-on signature", () => {
    for (const name of CHARLOTTE_EXTRA_NAMES) {
      const { svg, paths } = lassoPaths(name);
      expect(svg.getAttribute("stroke-width"), name).toBe("1.75");
      expect(svg.getAttribute("data-icon"), name).toBe(name);
      expect(paths.length, name).toBeGreaterThan(0);
      for (const p of paths) expect(p.getAttribute("pathLength"), name).toBe("1");
      expect(paths.filter((p) => p.classList.contains("nb-sig")).length, name).toBeGreaterThan(0);
    }
  });

  it("uses only signature animations that already exist in styles.css", () => {
    for (const name of CHARLOTTE_EXTRA_NAMES) {
      const sig = getIconSignature(name);
      expect(styles, `${name}: ${sig}`).toMatch(new RegExp(`@keyframes ${sig}\\b`));
    }
  });

  it("keeps Lasso and Charlotte drawings separate for the new names", () => {
    for (const name of CHARLOTTE_EXTRA_NAMES) {
      const lasso = lassoPaths(name).paths.map((p) => p.getAttribute("d"));
      const { container } = render(
        <SkinContext.Provider value="charlotte">
          <GraphiteIcon name={name} />
        </SkinContext.Provider>,
      );
      const charlotte = [...container.querySelectorAll("path")].map((p) => p.getAttribute("d"));
      expect(charlotte, name).toEqual(CHARLOTTE_EXTRA_GLYPHS[name]);
      expect(lasso, name).not.toEqual(charlotte);
    }
  });
});
