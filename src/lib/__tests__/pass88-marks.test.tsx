// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DrawnCheck, DrawnEllipse, DrawnStrike, claimMark, resetMarkGate, useMark } from "@/components/notebook/marks";

describe("mark gate", () => {
  beforeEach(() => resetMarkGate());

  it("lets one mark through and refuses the next inside 400ms", () => {
    expect(claimMark(1_000)).toBe(true);
    expect(claimMark(1_100)).toBe(false);
    expect(claimMark(1_399)).toBe(false);
  });

  it("lets a later mark through once the window has passed", () => {
    expect(claimMark(1_000)).toBe(true);
    expect(claimMark(1_400)).toBe(true);
  });

  it("renders nothing for the second mark in a viewport", () => {
    const first = render(<DrawnCheck />);
    expect(first.container.querySelector("svg")).not.toBeNull();
    const second = render(<DrawnStrike />);
    expect(second.container.querySelector("svg")).toBeNull();
  });

  it("draws graphite strokes with pathLength 1", () => {
    const { container } = render(<DrawnEllipse />);
    const path = container.querySelector("path");
    expect(path?.getAttribute("pathLength")).toBe("1");
    expect(container.querySelector("svg")?.getAttribute("stroke")).toBe("var(--nb-graphite)");
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("mark css", () => {
  const styles = readFileSync("src/styles.css", "utf8");

  it("draws under 300ms with the notebook easing", () => {
    expect(styles).toContain("@keyframes nb-mark-draw");
    expect(styles).toMatch(/\.nb-mark path \{[^}]*animation: nb-mark-draw 270ms var\(--nb-ease\)/);
  });

  it("is static and fully drawn under reduced motion", () => {
    const blocks = styles
      .split("@media (prefers-reduced-motion: reduce)")
      .slice(1)
      .filter((block) => block.includes(".nb-mark path"));
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const block of blocks) {
      const rule = block.slice(block.indexOf(".nb-mark path"));
      expect(rule).toContain("stroke-dasharray: none");
      expect(rule).toContain("animation: none !important");
    }
  });
});

describe("marks and the gallery stay presentation only", () => {
  const marks = readFileSync("src/components/notebook/marks.tsx", "utf8");
  const gallery = readFileSync("src/routes/_authenticated/design.icons.tsx", "utf8");

  it("carries no telemetry", () => {
    for (const source of [marks, gallery]) {
      expect(source).not.toContain("logEvent");
      expect(source).not.toContain("logV2");
      expect(source).not.toContain("recordEvent");
    }
  });

  it("keeps the gallery out of every nav source", () => {
    const navSources = [
      "src/components/layout/nav-config.ts",
      "src/components/layout/MobileTabBar.tsx",
      "src/components/layout/SidebarNav.tsx",
      "src/components/layout/AppSidebar.tsx",
    ].map((file) => readFileSync(file, "utf8"));
    for (const source of navSources) expect(source).not.toContain("design/icons");
  });

  it("uses no framer-motion anywhere in the pass", () => {
    const pkg = readFileSync("package.json", "utf8");
    expect(pkg).not.toContain("framer-motion");
    expect(marks).not.toContain("framer-motion");
    expect(gallery).not.toContain("framer-motion");
  });
});

describe("id-aware marks in list-shaped sites", () => {
  beforeEach(() => resetMarkGate());

  function List({ ids }: { ids: string[] }) {
    const check = useMark();
    return (
      <ul>
        {ids.map((id) => (
          <li key={id} data-testid={`row-${id}`}>
            <button type="button" onClick={() => check.fire(id)}>
              {`confirm-${id}`}
            </button>
            {check.markId === id ? <DrawnCheck key={check.markKey} /> : null}
          </li>
        ))}
      </ul>
    );
  }

  it("draws the mark on the acted row only", () => {
    const { getByText, getByTestId } = render(<List ids={["a", "b", "c"]} />);
    fireEvent.click(getByText("confirm-c"));
    expect(getByTestId("row-a").querySelector("svg")).toBeNull();
    expect(getByTestId("row-b").querySelector("svg")).toBeNull();
    expect(getByTestId("row-c").querySelector("svg")).not.toBeNull();
  });
});
