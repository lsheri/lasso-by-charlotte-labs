// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NavEngagement } from "@/lib/nav-groups";

const mocks = vi.hoisted(() => ({
  profile: { id: "p1", org_id: "o1", org_type: "company", clients_enabled: true, role: "worker" } as Record<string, unknown>,
  engagements: [] as unknown[],
  clientRows: [] as unknown[],
  archiveMatch: false,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, hash }: { children: ReactNode; className?: string; hash?: string }) => (
    <a className={className} href={hash ? `/archive#${hash}` : undefined}>{children}</a>
  ),
  useMatchRoute: () => ({ to }: { to: string }) => to === "/archive" && mocks.archiveMatch,
  useSearch: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { items: [] }, isLoading: false, error: null }),
  useQueryClient: () => ({ getQueryData: () => undefined, getQueryCache: () => ({ subscribe: () => () => {} }) }),
}));
vi.mock("@/hooks/use-profile", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useProfile: () => ({ data: mocks.profile, profiles: [mocks.profile] }),
}));
vi.mock("@/hooks/use-engagements", () => ({
  useEngagements: () => ({ data: mocks.engagements }),
}));
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: mocks.clientRows }),
  useInvalidateClients: () => () => {},
}));
vi.mock("@/components/engagements/SidebarCreateActions", () => ({
  SidebarCreateActions: () => (
    <>
      <button type="button">New client</button>
      <button type="button">New folder</button>
    </>
  ),
}));
vi.mock("@/hooks/use-affiliation", () => ({ useAffiliation: () => ({ data: null }) }));
vi.mock("@/hooks/use-coach-note-thread", () => ({ useUnreadNotesAboutMe: () => ({ data: [] }) }));
vi.mock("@/hooks/use-coaching-links", () => ({ useHasLiveCoachLink: () => false }));
vi.mock("@/hooks/use-coaching-reach", () => ({ useCoachingReach: () => ({ canReach: false }) }));
vi.mock("@/hooks/use-shared-with-me", () => ({ useSharedWithMe: () => ({ groups: [] }) }));
vi.mock("@/hooks/use-decisions", () => ({ useDecisions: () => ({ data: [] }) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn(), bucket: () => "0" }));
vi.mock("@/components/engagements/NewEngagementDialog", () => ({
  NewEngagementDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}));

import { SidebarNav } from "@/components/layout/SidebarNav";

afterEach(() => {
  cleanup();
  mocks.engagements = [];
  mocks.clientRows = [];
  mocks.archiveMatch = false;
  window.history.replaceState(null, "", "/");
});

const eng = (id: string, clients: NavEngagement["clients"]): NavEngagement => ({
  id,
  code: id.toUpperCase(),
  title: `Title ${id}`,
  clients,
});

const manyBoards = () =>
  Array.from({ length: 24 }, (_, i) =>
    eng(`e${i}`, { id: `c${i}`, name: `Client ${i}`, quick_folder: false, kind: "client", parent_id: null }),
  );

describe("SB1 single middle-column scroller and standing separation", () => {
  it("wraps the tree rows in the scroller and keeps the actions outside it", () => {
    mocks.engagements = manyBoards();
    const { container } = render(<SidebarNav />);
    const scroller = container.querySelector(".nb-nav-tree-scroll");
    expect(scroller).not.toBeNull();
    // The tree rows live inside the scroller.
    expect(scroller!.querySelector('[data-drop-zone="top"]')).not.toBeNull();
    expect(scroller!.textContent).toContain("Title e0");
    expect(scroller!.textContent).toContain("Title e23");
    // The actions block exists and is not inside the scroller.
    const actions = container.querySelector(".nb-nav-actions");
    expect(actions).not.toBeNull();
    expect(scroller!.contains(actions)).toBe(false);
    expect(actions!.contains(scroller!)).toBe(false);
  });

  it("sits the actions block after the tree in DOM order, with the top border rule, and the middle column (not the tree) as the single scroller", () => {
    mocks.engagements = manyBoards();
    const { container } = render(<SidebarNav />);
    const scroller = container.querySelector(".nb-nav-tree-scroll")!;
    const actions = container.querySelector(".nb-nav-actions")!;
    expect(
      scroller.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The standing separation is a hairline rule on the actions block. jsdom
    // does not load the stylesheet, so the rule is read from the sheet itself.
    const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");
    const rule = css.match(/\.nb-nav-actions\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain("border-top: 1px solid var(--nb-rule)");
    const scrollRule = css.match(/\.nb-nav-tree-scroll\s*\{[^}]*\}/);
    expect(scrollRule).not.toBeNull();
    // NAV-5: the sidebar's middle column is the single scroller; the tree is a plain list.
    expect(scrollRule![0]).not.toContain("overflow-y");
    expect(scrollRule![0]).not.toContain("max-height");
    const sidebarSrc = readFileSync(`${process.cwd()}/src/components/layout/AppSidebar.tsx`, "utf8");
    expect(sidebarSrc).toContain('className="flex min-h-0 flex-1 flex-col overflow-y-auto"');
  });

  it("keeps the create menu and Look back present with a long tree", () => {
    // MN-3b: create actions live behind the + beside Where it goes.
    mocks.engagements = manyBoards();
    render(<SidebarNav />);
    expect(screen.getByRole("button", { name: "New workboard, client or folder" })).toBeTruthy();
    expect(screen.getByText("Look back").closest("a")!).toBeTruthy();
  });

  it("drops the create tile and puts the single Look back row after the tree", () => {
    // MN-3b: the grouped create tile is gone; Look back is one row below the tree.
    mocks.engagements = manyBoards();
    const { container } = render(<SidebarNav />);
    const actions = container.querySelector(".nb-nav-actions")!;
    expect(actions.querySelector(".nb-nav-create-tile")).toBeNull();
    expect(actions.textContent).not.toContain("New workboard");
    const lookBack = screen.getAllByText("Look back");
    expect(lookBack).toHaveLength(1);
    expect(container.querySelector(".nb-nav-tree-scroll")!.compareDocumentPosition(lookBack[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const gone of ["Past work", "Archived", "Past Ask Lasso chats"]) expect(screen.queryByText(gone)).toBeNull();
  });

  it("activates Look back on the archive route without a hash", () => {
    mocks.archiveMatch = true;
    window.history.replaceState(null, "", "/archive");
    render(<SidebarNav />);
    expect(screen.getByText("Look back").closest("a")!.className).toContain("nb-nav-item-active");
  });

  it("leaves Look back inactive on the archive route with the archived hash", () => {
    mocks.archiveMatch = true;
    window.history.replaceState(null, "", "/archive#archived");
    render(<SidebarNav />);
    expect(screen.getByText("Look back").closest("a")!.className).not.toContain("nb-nav-item-active");
  });

  it("hides an archived container and everything beneath it", () => {
    mocks.clientRows = [
      { id: "archived", name: "Old client", kind: "client", parent_id: null, quick_folder: false, color: "blue", archived_at: "2026-10-05T12:00:00Z" },
      { id: "child", name: "Hidden child", kind: "folder", parent_id: "archived", quick_folder: false, color: null, archived_at: null },
      { id: "current", name: "Current client", kind: "client", parent_id: null, quick_folder: false, color: null, archived_at: null },
    ];
    mocks.engagements = [
      eng("hidden-board", { id: "child", name: "Hidden child", quick_folder: false, kind: "folder", parent_id: "archived" }),
      eng("current-board", { id: "current", name: "Current client", quick_folder: false, kind: "client", parent_id: null }),
    ];
    render(<SidebarNav />);
    expect(screen.queryByText("Old client")).toBeNull();
    expect(screen.queryByText("Hidden child")).toBeNull();
    expect(screen.queryByText("Title hidden-board")).toBeNull();
    expect(screen.getByText("Current client")).toBeTruthy();
    expect(screen.getByText("Title current-board")).toBeTruthy();
  });

  it("tints parent and child folder glyphs with the inherited container colour", () => {
    mocks.clientRows = [
      { id: "blue-client", name: "Blue client", kind: "client", parent_id: null, quick_folder: false, color: "blue", archived_at: null },
      { id: "blue-child", name: "Blue child", kind: "folder", parent_id: "blue-client", quick_folder: false, color: null, archived_at: null },
    ];
    const { container } = render(<SidebarNav />);
    const clientRow = container.querySelector('[data-tree-node="blue-client"] > .nb-nav-shelf');
    const childRow = container.querySelector('[data-tree-node="blue-child"] > .nb-nav-shelf');
    const clientGlyph = clientRow?.querySelector(':scope > span.flex.shrink-0');
    const childGlyph = childRow?.querySelector(':scope > span.flex.shrink-0');
    expect(clientRow).not.toBeNull();
    expect(childRow).not.toBeNull();
    expect(clientRow?.querySelector(".rounded-full")).toBeNull();
    expect(clientGlyph?.getAttribute("style")).toBe("color: var(--nb-region-blue-vivid);");
    expect(childGlyph?.getAttribute("style")).toBe("color: var(--nb-region-blue-vivid);");
  });

  it("keeps the separation when the tree is empty", () => {
    mocks.engagements = [];
    const { container } = render(<SidebarNav />);
    const scroller = container.querySelector(".nb-nav-tree-scroll");
    const actions = container.querySelector(".nb-nav-actions");
    expect(scroller).not.toBeNull();
    expect(actions).not.toBeNull();
    // The empty-tree line lives in the scroller; the actions still follow it.
    expect(scroller!.textContent).toContain("No workboards yet");
    expect(
      scroller!.compareDocumentPosition(actions!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "New workboard, client or folder" })).toBeTruthy();
    expect(screen.getByText("Look back").closest("a")!).toBeTruthy();
  });
});
