// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BoardViewControls } from "@/components/board/BoardViewControls";

afterEach(cleanup);

describe("B1 — the board header", () => {
  it("lets every zoom-control doodle play its hover signature", () => {
    const { container } = render(
      <BoardViewControls zoom={1} onFit={() => {}} onZoomOut={() => {}} onResetZoom={() => {}} onZoomIn={() => {}} />,
    );
    const icons = [...container.querySelectorAll(".nb-ico")];
    expect(icons).toHaveLength(3);
    for (const icon of icons) expect(icon.getAttribute("data-anim")).toBe("1");
    expect(readFileSync("src/components/board/BoardViewControls.tsx", "utf8")).not.toContain("animate={false}");
  });

  it("gives the toolbar row the thicker padding and a 56px floor", () => {
    const shell = readFileSync("src/components/board/BoardShell.tsx", "utf8");
    expect(shell).toMatch(/data-testid="board-shell-toolbar" className="[^"]*min-h-\[56px\][^"]*gap-2\.5[^"]*px-4 py-3/);
  });

  it("names the control Info and draws the working-from page", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain('aria-label="Info" data-toolbar-control="details"');
    expect(page).toMatch(/data-toolbar-control="details"[^\n]*<GraphiteIcon name="working-from" size=\{20\} \/>Info<\/Button>/);
  });
});
