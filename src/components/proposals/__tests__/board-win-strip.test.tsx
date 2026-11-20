// @vitest-environment jsdom
// The win strip on a phone: at the top of the board it covered the first card (seen live at 390, 20 Nov 2026).
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BoardWinLines } from "@/components/proposals/BoardWinStrip";
import { BOARD_WIN_COPY, deskDate } from "@/lib/proposal-desk-shared";

afterEach(cleanup);

const NOW = new Date("2026-11-20T12:00:00Z");

const css = readFileSync("src/styles/06-lasso-shell.css", "utf8");
const phone = css.slice(
  css.indexOf("@media (max-width: 767px)", css.indexOf(".canvas-lab-board-status {")),
);
const block = phone.slice(0, phone.indexOf("@media (prefers-reduced-motion"));

describe("the win strip keeps off the first card on a phone", () => {
  it("the strip carries the hook the phone rule moves, and still says everything it said", () => {
    render(
      <BoardWinLines
        now={NOW}
        win={{
          won: true,
          decidedAt: "2026-11-19T18:00:00Z",
          leadName: "Corin Ashby",
          ask: {
            name: "Corin Ashby",
            status: "delivered",
            reply: "yes",
            practice: false,
            waiting: false,
          },
        }}
      >
        <button type="button">Text the lead</button>
      </BoardWinLines>,
    );
    const strip = screen.getByTestId("board-win-strip");
    expect(strip.hasAttribute("data-board-win")).toBe(true);
    expect(strip.getAttribute("role")).toBe("status");
    expect(strip.textContent).toContain(BOARD_WIN_COPY.won(deskDate("2026-11-19T18:00:00Z", NOW)));
    expect(strip.querySelector("[data-board-lead]")?.textContent).toBe(
      BOARD_WIN_COPY.lead("Corin Ashby"),
    );
    expect(strip.querySelector("[data-board-lead-answer]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Text the lead" })).toBeTruthy();
  });

  it("below 768 the status column runs to the foot of the board, lets touches through, and the strip sits at its foot", () => {
    expect(block).toMatch(
      /\.canvas-lab-board-status \{[^}]*bottom: 16px;[^}]*flex-direction: column;[^}]*pointer-events: none;/,
    );
    expect(block).toMatch(/\.canvas-lab-board-status > \[data-board-win\] \{ margin-top: auto; order: 1; \}/);
  });

  // 20 Nov 2026 (QA M1 on #266): "> * { pointer-events: auto }" switched the offline alert's own
  // pointer-events: none back on, so below 768 it swallowed touches on the first card.
  it("below 768 only the win strip and the save alerts take a touch; the offline alert never does", () => {
    const rules = [...block.matchAll(/([^{}]+)\{([^}]*pointer-events:\s*auto[^}]*)\}/g)].map((m) => (m[1] as string).trim());
    expect(rules).toHaveLength(1);
    const selectors = (rules[0] as string).split(",").map((one) => one.trim());
    expect(selectors).toEqual([
      '[data-lasso="on"] .canvas-lab-board-status > .canvas-lab-banner',
      '[data-lasso="on"] .canvas-lab-board-status > [data-board-win]',
    ]);
    // No rule in the phone block may reach every child, or the offline alert by name.
    expect(block).not.toMatch(/canvas-lab-board-status > \*/);
    expect(block).not.toMatch(/offline-pill/);
    // The alert's own rule still lets touches through, and the alert is still a child of the column.
    const pill = readFileSync("src/styles/02-icons-board-sidebar.css", "utf8");
    expect(pill.slice(pill.indexOf(".canvas-lab-offline-pill {"), pill.indexOf("}", pill.indexOf(".canvas-lab-offline-pill {")))).toMatch(/pointer-events: none;/);
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const column = page.slice(page.indexOf('className="canvas-lab-board-status"'));
    expect(column.indexOf("<BoardOfflineBanner")).toBeLessThan(column.indexOf("</div>\n          <BoardToolbarSurface"));
    expect(readFileSync("src/components/canvas-lab/BoardOfflineBanner.tsx", "utf8")).toContain('className="canvas-lab-offline-pill"');
  });

  it("below 768 a save alert stays under the toolbar when there is a win strip: the strip is drawn last", () => {
    expect(block).toMatch(/> \[data-board-win\] \{[^}]*order: 1;/);
    expect(block).not.toMatch(/canvas-lab-banner[^{]*\{[^}]*order:/);
  });

  it("on a desktop nothing moved: the column is still the top-left box", () => {
    expect(css).toContain(
      '[data-lasso="on"] .canvas-lab-board-status { position: absolute; top: 82px; left: 16px; z-index: 25; max-width: min(280px, calc(100% - 32px)); pointer-events: auto; }',
    );
  });

  it("a board that was not won shows nothing", () => {
    const { container } = render(<BoardWinLines win={{ won: false }} />);
    expect(container.textContent).toBe("");
  });
});
