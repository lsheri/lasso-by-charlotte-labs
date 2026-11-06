// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardShell } from "@/components/board/BoardShell";
import { HomeBoard } from "@/components/home/HomeBoard";

const home = vi.hoisted(() => ({ accept: vi.fn(async () => null), previewIds: vi.fn(), opened: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: any) => <a href={params ? `/engagements/${params.id}/canvas-lab` : to} {...props}>{children}</a>,
}));
vi.mock("@/components/layout/SharedWithYou", () => ({
  SHARED_WITH_YOU_COPY: { inviteLabel: "INVITE · WAITING FOR YOU", accept: "Accept", invited: (name: string) => `${name} wants you to see this board.`, failed: "Could not open" },
  useOpenShared: () => home.opened,
  useAcceptBoardShare: () => home.accept,
  useSharedWithYou: () => ({
    shared: [{ engagement_id: "shared-1", title: "Shared board", host_org: "Host", added_at: "2026-11-05T12:00:00Z" }],
    pending: [{ invite_id: "invite-1", board: "Pending board", invited_by: "Partner", code: "invite-code", level: "review" }],
  }),
}));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "person", org_id: "org" } }) }));
vi.mock("@/hooks/use-engagements", () => ({ useEngagements: () => ({ data: [{ id: "own-1", code: "OWN", title: "Own board" }] }) }));
vi.mock("@/hooks/use-engagement-views", () => ({ useEngagementViews: () => ({ data: [] }) }));
vi.mock("@/hooks/use-engagement-work-counts", () => ({ useEngagementWorkCounts: () => ({ data: undefined }) }));
vi.mock("@/hooks/use-work-items", () => ({ useWorkItems: () => ({ data: undefined }) }));
vi.mock("@/hooks/use-engagement-board-previews", () => ({ useEngagementBoardPreviews: (ids: string[]) => { home.previewIds(ids); return { previews: new Map() }; } }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/client-telemetry", () => ({ emitClientEvent: vi.fn() }));
vi.mock("@/components/engagements/NewEngagementDialog", () => ({ NewEngagementDialog: ({ trigger }: any) => trigger }));

afterEach(cleanup);

describe("Home native scroll opt-in", () => {
  it("HOME-1: merges shared boards into the grid and keeps the pending Accept action above it", async () => {
    render(<HomeBoard />);
    const grid = screen.getByTestId("home-engagement-grid");
    expect(grid.querySelectorAll("li")).toHaveLength(2);
    expect(grid.querySelector("li")?.getAttribute("data-shared")).toBe("true");
    expect(screen.queryByTestId("home-shared-shelf")).toBeNull();
    expect(home.previewIds).toHaveBeenCalledWith(["own-1", "shared-1"]);
    const pending = screen.getByTestId("home-pending-invites");
    expect(pending.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await vi.waitFor(() => expect(home.accept).toHaveBeenCalledWith("invite-code", "review", "home"));
  });
  it("leaves wheel scrolling to the browser and enables vertical touch scrolling", () => {
    render(<BoardShell frames={[]} nodes={[]} renderNode={() => null} lockZoom nativeScroll />);
    const shell = screen.getByTestId("board-shell");
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 500 });
    shell.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(shell.querySelector(".canvas-lab-surface")?.className).toContain("touch-pan-y");
    expect(screen.getByTestId("board-shell-stage").style.transform).toBe("translate(0px, 0px) scale(1)");
  });
});