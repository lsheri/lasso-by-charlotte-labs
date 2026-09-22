// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { describe, expect, it, vi } from "vitest";

import { BoardDetailsContent } from "@/components/canvas-lab/BoardDetailsPopover";
import type { EngagementRow } from "@/lib/engagement-page-shared";

// The popover hands off to the details page with a plain link; the router is
// not under test here.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

const toolbarSource = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");

const ENGAGEMENT = {
  id: "eng-1",
  code: "ACME-24",
  title: "Working title",
  client_label: "Fallback label",
  brief: "A short brief.",
  brief_by: null,
  term_label: "Spring 2026",
  clients: { id: "client-1", name: "Acme Corp", quick_folder: false },
} as unknown as EngagementRow;

const COACHES = [
  {
    id: "coach-1",
    display_name: "Charlotte Reeves",
    added_at: "2026-01-04T10:00:00Z",
    added_by_name: "Should Never Render",
  },
];

const MEMBERS = [{ id: "member-1", display_name: "Liam Ortiz" }];

describe("R9 board details popover", () => {
  it("the board toolbar opens a popover from the control and the overflow item, never navigating", () => {
    const spec = toolbarSource.match(/id: "details"[\s\S]*?toolbarItems\.push/s)?.[0] ?? "";
    expect(spec).toContain('data-toolbar-control="details"');
    expect(spec).toContain("openDetails(event.currentTarget)");
    expect(spec).toContain("openDetails(moreButtonRef.current)");
    expect(spec).not.toContain("<Link");
    // The popover reads the engagement payload the board already holds.
    expect(toolbarSource).toContain("<BoardDetailsContent");
    expect(toolbarSource).toContain("members={page?.members ?? []}");
  });

  it("renders client, title, and the quiet term and code line", () => {
    render(
      <BoardDetailsContent
        engagement={ENGAGEMENT}
        coaches={COACHES}
        members={MEMBERS}
        engagementId="eng-1"
      />,
    );
    expect(screen.getByText("Acme Corp")).toBeTruthy();
    expect(screen.getByText("Working title")).toBeTruthy();
    expect(screen.getByText("Spring 2026 · ACME-24")).toBeTruthy();
  });

  it("renders no edit control of any kind", () => {
    const { container } = render(
      <BoardDetailsContent
        engagement={ENGAGEMENT}
        coaches={COACHES}
        members={MEMBERS}
        engagementId="eng-1"
      />,
    );
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });

  it("renders access as display names only, without who added them or when", () => {
    render(
      <BoardDetailsContent
        engagement={ENGAGEMENT}
        coaches={COACHES}
        members={MEMBERS}
        engagementId="eng-1"
      />,
    );
    expect(screen.getByText("Charlotte Reeves")).toBeTruthy();
    expect(screen.getByText("Liam Ortiz")).toBeTruthy();
    expect(screen.queryByText(/Should Never Render/)).toBeNull();
    expect(screen.queryByText(/2026-01-04/)).toBeNull();
  });

  it("truncates a long brief with a handoff link and shows none for a short one", () => {
    const longBrief = "A much longer brief. ".repeat(30);
    render(
      <BoardDetailsContent
        engagement={{ ...ENGAGEMENT, brief: longBrief } as EngagementRow}
        coaches={COACHES}
        members={MEMBERS}
        engagementId="eng-1"
      />,
    );
    expect(screen.getByText("Read the full brief")).toBeTruthy();
    render(
      <BoardDetailsContent
        engagement={ENGAGEMENT}
        coaches={COACHES}
        members={MEMBERS}
        engagementId="eng-1"
      />,
    );
    expect(screen.queryAllByText("Read the full brief")).toHaveLength(1);
  });

  it("renders a quiet empty state when the engagement has not loaded", () => {
    render(
      <BoardDetailsContent engagement={null} coaches={[]} members={[]} engagementId="eng-1" />,
    );
    expect(screen.getByText("Nothing to show yet.")).toBeTruthy();
  });
});
