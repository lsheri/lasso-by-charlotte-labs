import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GraphiteIcon, ICON_NAMES } from "@/components/notebook/icons";

describe("GraphiteIcon", () => {
  it("renders a path per subpath, each with pathLength=1", () => {
    const { container } = render(<GraphiteIcon name="settings" />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(3);
    paths.forEach((p) => expect(p.getAttribute("pathLength")).toBe("1"));
  });

  it("marks only the signed path with nb-sig", () => {
    const { container } = render(<GraphiteIcon name="settings" />);
    const signed = container.querySelectorAll("path.nb-sig");
    expect(signed.length).toBe(1);
    expect(container.querySelector("svg")?.getAttribute("data-icon")).toBe("settings");
  });

  it("signs every path when no sigIndex is given", () => {
    const { container } = render(<GraphiteIcon name="firm" />);
    expect(container.querySelectorAll("path.nb-sig").length).toBe(3);
  });

  it("exposes all 24 glyphs", () => {
    expect(ICON_NAMES.length).toBe(24);
  });
});

describe("notebook icon css", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  it("makes icons fully static under reduced motion", () => {
    const block = styles.slice(styles.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toContain(".nb-ico path");
    expect(block).toContain("stroke-dasharray: none");
    expect(block).toContain("animation: none !important");
    expect(block).toContain("transform: none !important");
  });

  it("keeps the sidebar grammar classes", () => {
    expect(styles).toContain(".nb-group-header");
    expect(styles).toContain(".nb-nav-item-active::before");
  });
});
