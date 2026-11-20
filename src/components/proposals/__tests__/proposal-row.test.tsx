// @vitest-environment jsdom
// 20 Nov 2026 (design review): the redrawn proposal row. One filled button for the next step, the clock as a bar
// beside its line, and every control the row had still there under the same name.
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clockShare, ProposalRow } from "@/components/proposals/ProposalRow";
import { CLOSE_COPY, DESK_COPY, SENT_COPY, WIN_COPY, type DeskProposal } from "@/lib/proposal-desk-shared";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params?: { id?: string } }) => <a href={`/engagements/${params?.id}/canvas-lab`}>{children}</a>,
}));

afterEach(cleanup);

const NOW = new Date("2026-11-20T12:00:00Z");
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();
const proposal = (over: Partial<DeskProposal>): DeskProposal => ({
  id: "p", title: "Network redesign", clientName: "Marrowfield", ownerName: "Maren Hollis", mine: true, status: "open",
  receivedAt: hoursAgo(18), sentAt: null, decidedAt: null, engagementId: null, contextCount: 0, canAct: true, canClose: true, canArchive: true, ...over,
});
const row = (over: Partial<DeskProposal>, handlers = true) =>
  render(<ul><ProposalRow proposal={proposal(over)} goalHours={72} now={NOW} onSent={handlers ? vi.fn() : undefined} onWin={handlers ? vi.fn() : undefined} onClose={handlers ? vi.fn() : undefined} /></ul>);
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
    expect(screen.getByRole("button", { name: SENT_COPY.undo })).toBeTruthy();
    cleanup();
    // Someone else's proposal an admin may mark sent: no win button, and sending is the filled one.
    row({ mine: false });
    expect(filled()).toEqual([SENT_COPY.mark]);
    expect(screen.queryByRole("button", { name: WIN_COPY.record })).toBeNull();
    cleanup();
    // Read only: nothing to press.
    row({}, false);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("keeps every quiet control: lost, archive, and the board link on a win", () => {
    row({});
    const close = document.querySelector("[data-proposal-close]") as HTMLElement;
    expect(within(close).getByRole("button", { name: CLOSE_COPY.lost })).toBeTruthy();
    expect(within(close).getByRole("button", { name: CLOSE_COPY.archive })).toBeTruthy();
    cleanup();
    row({ status: "won", decidedAt: "2026-11-20T09:00:00Z", engagementId: "b1", canArchive: false });
    expect(document.querySelector("[data-proposal-won]")?.textContent).toBe("Won Fri 20 Nov");
    expect(screen.getByRole("link", { name: DESK_COPY.openBoard }).getAttribute("href")).toBe("/engagements/b1/canvas-lab");
    cleanup();
    row({ status: "lost", decidedAt: "2026-11-20T09:00:00Z" });
    expect(document.querySelector("[data-proposal-won]")).toBeNull();
    expect(screen.getByText("Lost Fri 20 Nov")).toBeTruthy();
  });

  it("draws the clock as a bar that only decorates its line", () => {
    row({});
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

  it("clockShare stays between nothing and all of it", () => {
    expect(clockShare({ state: "running", hoursLeft: 72 }, 72)).toBe(0);
    expect(clockShare({ state: "running", hoursLeft: 0 }, 72)).toBe(1);
    expect(clockShare({ state: "running", hoursLeft: 500 }, 72)).toBe(0);
    expect(clockShare({ state: "running", hoursLeft: 5 }, 0)).toBe(1);
    expect(clockShare({ state: "over", hoursOver: 3 }, 72)).toBe(1);
    expect(clockShare({ state: "sent", hoursTaken: 3, withinGoal: true }, 72)).toBe(1);
  });
});
