// @vitest-environment jsdom
// 20 Nov 2026 (design review): the redrawn proposal row. One filled button for the next step, the clock as a bar
// beside its line, and every control the row had still there under the same name.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clockShare, isAtGoal, ProposalRow } from "@/components/proposals/ProposalRow";
import { CLOSE_COPY, DESK_COPY, SENT_COPY, WIN_COPY, type DeskProposal } from "@/lib/proposal-desk-shared";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params?: { id?: string } }) => <a href={`/engagements/${params?.id}/canvas-lab`}>{children}</a>,
}));

afterEach(cleanup);

/** D-86: Undo sent, Close as lost and Archive live under More. Opens it and returns the menu, or null when there is none. */
const openMore = (scope: ParentNode = document) => {
  const trigger = scope.querySelector("[data-proposal-more]") as HTMLElement | null;
  if (!trigger) return null;
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  return document.querySelector("[data-proposal-close]") as HTMLElement | null;
};

const NOW = new Date("2026-11-20T12:00:00Z");
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();
const proposal = (over: Partial<DeskProposal>): DeskProposal => ({
  id: "p", title: "Network redesign", clientName: "Marrowfield", ownerName: "Maren Hollis", mine: true, status: "open",
  receivedAt: hoursAgo(18), sentAt: null, decidedAt: null, engagementId: null, contextCount: 0, canAct: true, canClose: true, canArchive: true, ...over,
});
const row = (over: Partial<DeskProposal>, handlers = true, featured = true) =>
  render(<ul><ProposalRow featured={featured} proposal={proposal(over)} goalHours={72} now={NOW} onSent={handlers ? vi.fn() : undefined} onWin={handlers ? vi.fn() : undefined} onClose={handlers ? vi.fn() : undefined} /></ul>);
const filled = () => screen.getAllByRole("button").filter((b) => /\bbg-ember\b/.test(b.className)).map((b) => b.textContent);

describe("the redrawn proposal row", () => {
  it("reads who it is for first, with what they asked for beneath, and still says both to a screen reader", () => {
    row({});
    const title = document.querySelector("[data-proposal-title]") as HTMLElement;
    expect(title.textContent).toBe("Marrowfield: Network redesign");
    expect(title.firstElementChild?.className).toMatch(/font-semibold/);
    cleanup();
    row({ clientName: "" });
    expect(document.querySelector("[data-proposal-title]")?.textContent).toBe("Network redesign");
  });

  it("fills one button only: sending first, then recording the win", () => {
    row({});
    expect(filled()).toEqual([SENT_COPY.mark]);
    expect(screen.getByRole("button", { name: WIN_COPY.record })).toBeTruthy();
    cleanup();
    row({ sentAt: hoursAgo(2) });
    expect(filled()).toEqual([WIN_COPY.record]);
    // Taking it back says what the press does, and sits with the quiet changes, not beside the status line.
    expect(SENT_COPY.undo).toBe("Undo sent");
    expect(within(openMore() as HTMLElement).getByRole("menuitem", { name: SENT_COPY.undo })).toBeTruthy();
    cleanup();
    // Someone else's proposal an admin may mark sent: no win button, and sending is the filled one.
    row({ mine: false });
    expect(filled()).toEqual([SENT_COPY.mark]);
    expect(screen.queryByRole("button", { name: WIN_COPY.record })).toBeNull();
    cleanup();
    // Read only: nothing to press.
    row({}, false);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    cleanup();
    // D-86: only the Up next row fills its button, so the page has one. Every other row's step is outlined.
    row({}, true, false);
    expect(filled()).toEqual([]);
    expect(screen.getByRole("button", { name: SENT_COPY.mark })).toBeTruthy();
    expect(document.querySelector("[data-up-next-label]")).toBeNull();
  });

  it("the Up next row says so, above who it is for", () => {
    row({});
    expect(document.querySelector("[data-proposal-row]")?.hasAttribute("data-up-next")).toBe(true);
    expect(document.querySelector("[data-up-next-label]")?.textContent).toBe("Up next");
  });

  it("keeps every quiet control: lost, archive, and the board link on a win", () => {
    row({});
    const more = document.querySelector("[data-proposal-more]") as HTMLElement;
    expect(more.getAttribute("aria-label")).toBe("More for Marrowfield: Network redesign");
    const close = openMore() as HTMLElement;
    expect(within(close).getByRole("menuitem", { name: CLOSE_COPY.lost })).toBeTruthy();
    expect(within(close).getByRole("menuitem", { name: CLOSE_COPY.archive })).toBeTruthy();
    cleanup();
    row({ status: "won", decidedAt: "2026-11-20T09:00:00Z", engagementId: "b1", canArchive: false });
    expect(document.querySelector("[data-proposal-won]")?.textContent).toBe("Won Fri 20 Nov");
    expect(screen.getByRole("link", { name: DESK_COPY.openBoard }).getAttribute("href")).toBe("/engagements/b1/canvas-lab");
    cleanup();
    row({ status: "lost", decidedAt: "2026-11-20T09:00:00Z" });
    expect(document.querySelector("[data-proposal-won]")).toBeNull();
    expect(screen.getByText("Lost Fri 20 Nov")).toBeTruthy();
  });

  it("draws the clock as a bar that only decorates its line, with a mark at the goal", () => {
    row({});
    expect(document.querySelector("[data-proposal-goal-mark]")?.getAttribute("aria-hidden")).toBe("true");
    const bar = document.querySelector("[data-proposal-clock-bar]") as HTMLElement;
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("25%");
    expect(document.querySelector('[data-proposal-clock="running"]')?.textContent).toBe("54 hours left of 72");
    cleanup();
    row({ receivedAt: hoursAgo(80) });
    expect((document.querySelector("[data-proposal-clock-bar]")?.firstElementChild as HTMLElement).className).toMatch(/bg-destructive/);
    expect(document.querySelector('[data-proposal-clock="over"]')).not.toBeNull();
    cleanup();
    row({ receivedAt: hoursAgo(10), sentAt: hoursAgo(4) });
    expect((document.querySelector("[data-proposal-clock-bar]") as HTMLElement).className).toContain("--good-tint");
  });

  // 20 Nov 2026, QA lows on #263.
  it("a proposal that went out late is not drawn as a healthy full bar, and its words still say by how much", () => {
    row({ receivedAt: hoursAgo(110), sentAt: hoursAgo(10) });
    const fill = document.querySelector("[data-proposal-clock-bar]")?.firstElementChild as HTMLElement;
    expect(fill.className).toMatch(/bg-destructive/);
    expect(fill.className).not.toMatch(/action-fill|good-mark/);
    expect(document.querySelector('[data-proposal-clock="sent"]')?.textContent).toBe("Went out in 100 hours, over the 72 hour goal");
    cleanup();
    row({ receivedAt: hoursAgo(40), sentAt: hoursAgo(10) });
    expect((document.querySelector("[data-proposal-clock-bar]")?.firstElementChild as HTMLElement).className).toMatch(/good-mark/);
  });

  it("exactly at the goal reads as at the goal, an hour either side reads as before", () => {
    row({ receivedAt: hoursAgo(72) });
    expect(document.querySelector("[data-proposal-clock]")?.textContent).toBe("At the 72 hour goal");
    cleanup();
    row({ receivedAt: hoursAgo(71.5) });
    expect(document.querySelector("[data-proposal-clock]")?.textContent).toBe("Less than an hour left of 72");
    cleanup();
    row({ receivedAt: hoursAgo(73) });
    expect(document.querySelector("[data-proposal-clock]")?.textContent).toBe("Over the 72 hour goal by 1 hour");
    expect(isAtGoal("nonsense", 72, NOW)).toBe(false);
  });

  it("clockShare stays between nothing and all of it", () => {
    expect(clockShare({ state: "running", hoursLeft: 72 }, 72)).toBe(0);
    expect(clockShare({ state: "running", hoursLeft: 0 }, 72)).toBe(1);
    expect(clockShare({ state: "running", hoursLeft: 500 }, 72)).toBe(0);
    expect(clockShare({ state: "running", hoursLeft: 5 }, 0)).toBe(1);
    expect(clockShare({ state: "over", hoursOver: 3 }, 72)).toBe(1);
    expect(clockShare({ state: "sent", hoursTaken: 3, withinGoal: true }, 72)).toBe(1);
  });
});
