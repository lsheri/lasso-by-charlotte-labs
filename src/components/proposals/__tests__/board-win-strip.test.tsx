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
    expect(block).toMatch(/\.canvas-lab-board-status > \* \{ pointer-events: auto; \}/);
    expect(block).toMatch(/\.canvas-lab-board-status > \[data-board-win\] \{ margin-top: auto; \}/);
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
