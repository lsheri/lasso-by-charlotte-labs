// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  STICKY_FILL_NAMES,
  STICKY_MARK_PAPER,
  StickyMark,
} from "@/components/canvas-lab/StickyMark";
import { WORKBOARD_STICKY_FILLS } from "@/lib/canvas-lab-shared";

afterEach(cleanup);

describe("S1 one sticky drawing everywhere", () => {
  it("the stack is three real-paper sheets: turquoise at the back, mint in the middle, yellow on top", () => {
    const { container } = render(<StickyMark variant="stack" />);
    const svg = container.querySelector('svg[data-sticky-mark="stack"]')!;
    const fills = [...svg.querySelectorAll("linearGradient")].map((g) => g.id.split("-").pop());
    expect(fills).toEqual(["blue", "green", "yellow"]);
    expect(svg.querySelectorAll("feDropShadow")).toHaveLength(1);
  });

  it("a sheet takes the sticky's own colour", () => {
    const { container } = render(<StickyMark variant="sheet" fill="pink" />);
    const stops = [...container.querySelectorAll("stop")].map((s) => s.getAttribute("stop-color"));
    expect(stops).toEqual([STICKY_MARK_PAPER.pink.top, STICKY_MARK_PAPER.pink.bottom]);
  });

  it("two marks on one page never share a gradient or a shadow", () => {
    const { container } = render(
      <>
        <StickyMark variant="stack" />
        <StickyMark variant="stack" />
      </>,
    );
    const ids = [...container.querySelectorAll("linearGradient, filter")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is decoration: the button around it carries the name", () => {
    const { container } = render(<StickyMark variant="sheet" />);
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("lines can be turned off when a number or a face sits on the sticky", () => {
    const { container } = render(<StickyMark variant="sheet" lines={false} />);
    expect(container.querySelector("path[stroke]")).toBeNull();
  });
});

describe("S1 the colours: blue becomes turquoise, green is mint, stored keys never change", () => {
  it("every stored colour has the name people see", () => {
    expect(WORKBOARD_STICKY_FILLS.map((fill) => STICKY_FILL_NAMES[fill])).toEqual([
      "Yellow",
      "Mint",
      "Turquoise",
      "Pink",
      "Grey",
    ]);
    expect([...WORKBOARD_STICKY_FILLS]).toEqual(["yellow", "green", "blue", "pink", "grey"]);
  });
  it("the board's sticky tokens are mint and turquoise", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("--sticky-green: #d6f5e4; --sticky-green-edge: #9fd9b9;");
    expect(css).toContain("--sticky-blue: #cdf1ee; --sticky-blue-edge: #86d0c8;");
  });
});

describe("S1 wiring (pinned in source)", () => {
  it("the board toolbar's Sticky button draws the stack", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain('data-toolbar-control="add-sticky"');
    expect(page).toContain('<StickyMark variant="stack" size={22} /></Button>');
    expect(page).not.toContain('<GraphiteIcon name="sticky"');
  });
  it("the public demo's Add sticky mirrors the board", () => {
    expect(readFileSync("src/components/demo/DemoWorkboardSandbox.tsx", "utf8")).toContain(
      '<StickyMark variant="stack" size={18} />Add sticky',
    );
  });
  it("swatches say Mint and Turquoise, not green and blue", () => {
    expect(readFileSync("src/components/canvas-lab/LabSticky.tsx", "utf8")).toContain(
      "aria-label={STICKY_FILL_NAMES[fill]}",
    );
  });
});
