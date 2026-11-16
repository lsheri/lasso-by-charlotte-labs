// @vitest-environment jsdom
// Liam, 15 Nov: a folder shows its folders, its boards and their docs and chats as a list, not every work card.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientPage, matchesContextFilter } from "@/pages/ClientPage";

const item = (id: string, type: string, title: string, board: string | null, at: string, clientId: string | null = null) => ({
  id, type, title, display_title: null, client_id: clientId, created_at: at, updated_at: at, captured_at: at, work_date: null, visibility: board ? "mapped" : "unmapped",
  source: "mcp", source_vendor: "claude", meta: {}, source_meta: {},
  work_item_tasks: board ? [{ task_id: "t", tasks: { id: "t", engagement_id: board } }] : [],
});

vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "p1", org_id: "o1", org_type: "company", role: "worker" } }) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/hooks/use-work-items", () => ({
  useWorkItems: () => ({
    data: {
      items: [
        item("w1", "ai_thread", "Pricing chat", "b1", "2026-11-10T10:00:00Z"),
        item("w2", "document", "Org structure doc", "b2", "2026-11-12T10:00:00Z"),
        item("w3", "deck", "Kickoff deck", null, "2026-11-01T10:00:00Z", "f1"),
        item("w4", "document", "Elsewhere", "other-board", "2026-11-13T10:00:00Z"),
      ],
    },
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data:
      queryKey[0] === "client"
        ? { id: "f1", name: "Cheeses", code: "CHEES", quick_folder: false, kind: "client", parent_id: null }
        : queryKey[0] === "client-engagements"
          ? [{ id: "b1", title: "Cheese Test", created_at: "2026-10-01T00:00:00Z" }, { id: "b2", title: "Tasting plan", created_at: "2026-10-02T00:00:00Z" }]
          : [{ id: "f2", name: "Soft cheeses" }],
    isLoading: false,
    isSuccess: true,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => <a className={className}>{children}</a>,
}));
vi.mock("@/components/engagements/NewEngagementDialog", () => ({ NewEngagementDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</> }));
vi.mock("@/components/peek/PeekPanel", () => ({
  PeekPanel: ({ entry, open }: { entry: { title: string } | null; open: boolean }) => (open && entry ? <div data-testid="peek">{entry.title}</div> : null),
}));

afterEach(cleanup);

describe("the folder page", () => {
  it("lists folders, boards without codes, and the folder's context newest first", () => {
    render(<ClientPage clientId="f1" />);
    expect(screen.getByText("1 folder · 2 workboards · 3 pieces of context")).toBeTruthy();
    expect(screen.getByText("Soft cheeses")).toBeTruthy();
    const boards = within(screen.getByRole("region", { name: "Workboards" }));
    expect(boards.getByText("Cheese Test")).toBeTruthy();
    expect(boards.getAllByText(/^1 piece · updated /)).toHaveLength(2);
    expect(screen.queryByText(/CHEES/)).toBeNull();
    const rows = within(screen.getByRole("region", { name: "Context" })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Org structure doc"),
      expect.stringContaining("Pricing chat"),
      expect.stringContaining("Kickoff deck"),
    ]);
    expect(screen.queryByText("Elsewhere")).toBeNull();
    expect(screen.getByText("No board yet")).toBeTruthy();
  });

  it("narrows to docs or chats and opens a row in the quick view", () => {
    render(<ClientPage clientId="f1" />);
    fireEvent.click(screen.getByRole("button", { name: "Chats" }));
    expect(screen.queryByText("Org structure doc")).toBeNull();
    fireEvent.click(screen.getByText("Pricing chat"));
    expect(screen.getByTestId("peek").textContent).toBe("Pricing chat");
  });

  it("files decks and sheets under docs", () => {
    expect(matchesContextFilter({ type: "deck" }, "docs")).toBe(true);
    expect(matchesContextFilter({ type: "sheet" }, "docs")).toBe(true);
    expect(matchesContextFilter({ type: "ai_thread" }, "docs")).toBe(false);
    expect(matchesContextFilter({ type: "email" }, "all")).toBe(true);
  });
});
