// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildContainerTree, descendantContainerIds, type NavEngagement } from "@/lib/nav-groups";

const mocks = vi.hoisted(() => ({
  profile: { id: "p1", org_id: "o1", org_type: "company", clients_enabled: true, role: "worker" } as Record<string, unknown>,
  engagements: [] as unknown[],
  clientRows: [] as unknown[],
  active: undefined as string | undefined,
  events: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, onClick, params }: { children: ReactNode; className?: string; onClick?: () => void; params?: { id: string } }) => (
    <a className={className} onClick={onClick} href={params ? `/engagements/${params.id}` : "#"}>{children}</a>
  ),
  useMatchRoute: () => ({ to }: { to: string }) => to === "/engagements/$id" && mocks.active ? { id: mocks.active } : false,
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
vi.mock("@/lib/telemetry", () => ({ logEvent: mocks.events, bucket: () => "0" }));
vi.mock("@/components/engagements/NewEngagementDialog", () => ({
  NewEngagementDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}));

import { SidebarNav } from "@/components/layout/SidebarNav";

afterEach(() => {
  cleanup();
  mocks.engagements = [];
  mocks.clientRows = [];
  window.localStorage.clear();
  mocks.active = undefined;
  mocks.profile["id"] = "p1";
  vi.restoreAllMocks();
  mocks.events.mockClear();
});



import { BoardFinder } from "@/components/layout/BoardFinder";
import { activeBoardChain, filterBoardTree, treeBoards, rememberBoardOpen, readRecentBoards, useContainerOpenState } from "@/lib/sidebar-tree-state";

const containers = [
  { id: "c1", name: "Acme", kind: "client", parent_id: null, quick_folder: false },
  { id: "f1", name: "Research", kind: "folder", parent_id: "c1", quick_folder: false },
  { id: "c2", name: "Bravo", kind: "client", parent_id: null, quick_folder: false },
];
function boards(count: number): NavEngagement[] {
  return Array.from({ length: count }, (_, i) => ({ id: `e${i}`, code: `E${i}`, title: i === 0 ? "Deep analysis" : `Board ${i}`,
    clients: i === 0 ? { id: "f1", name: "Research", quick_folder: false, kind: "folder", parent_id: "c1" } : { id: "c2", name: "Bravo", quick_folder: false, kind: "client", parent_id: null } }));
}
function setup(count = 10) {
  mocks.clientRows = containers;
  mocks.engagements = boards(count);
  return render(<SidebarNav />);
}
describe("MN-7 tree at scale", () => {
  it("Recent is hidden below six boards even with history", () => {
    rememberBoardOpen("p1", "e0"); setup(5);
    expect(screen.queryByTestId("recent-boards")).toBeNull();
  });
  it("Recent is hidden without history", () => {
    setup(); expect(screen.queryByTestId("recent-boards")).toBeNull();
  });
  it("keeps at most three ids, skips deleted and archived boards, and scopes by profile", () => {
    for (const id of ["e0", "e1", "deleted", "e2"]) rememberBoardOpen("p1", id);
    expect(readRecentBoards("p1")).toEqual(["e2", "deleted", "e1"]);
    mocks.clientRows = containers; mocks.engagements = boards(10).map((board) => board.id === "e1" ? { ...board, archived_at: "2026-10-01" } : board);
    const view = render(<SidebarNav />);
    expect(screen.getByTestId("recent-boards").querySelectorAll("a")).toHaveLength(1);
    expect(screen.getByTestId("recent-boards").textContent).toContain("Board 2Bravo");
    mocks.profile["id"] = "p2"; view.rerender(<SidebarNav />);
    expect(screen.queryByTestId("recent-boards")).toBeNull();
  });
  it("Recent excludes boards under archived containers", () => {
    rememberBoardOpen("p1", "e0"); mocks.clientRows = containers.map((row) => row.id === "c1" ? { ...row, archived_at: "2026-10-01" } : row);
    mocks.engagements = boards(10); render(<SidebarNav />);
    expect(screen.queryByTestId("recent-boards")).toBeNull();
  });
  it("Find is hidden under ten boards and visible at ten", () => {
    const view = setup(9); expect(screen.queryByRole("textbox", { name: "Find a board" })).toBeNull();
    mocks.engagements = boards(10); view.rerender(<SidebarNav />);
    expect(screen.getByRole("textbox", { name: "Find a board" })).toBeTruthy();
  });
  it("defaults closed except the active board chain, including the canvas route", () => {
    mocks.active = "e0"; setup();
    expect(screen.getByText("Research")).toBeTruthy(); expect(screen.getByText("Deep analysis")).toBeTruthy();
    expect(screen.queryByText("Board 1")).toBeNull();
  });
  it("filter expands only matching parents, hides others, and Escape and clearing restore prior state", () => {
    setup(); expect(screen.queryByText("Deep analysis")).toBeNull();
    const input = screen.getByRole("textbox", { name: "Find a board" });
    fireEvent.change(input, { target: { value: "DEEP" } });
    expect(screen.getByText("Acme")).toBeTruthy(); expect(screen.getByText("Research")).toBeTruthy();
    expect(screen.getByText("Deep analysis")).toBeTruthy(); expect(screen.queryByText("Bravo")).toBeNull();
    fireEvent.keyDown(input, { key: "Escape" }); expect(screen.queryByText("Deep analysis")).toBeNull(); expect(screen.getByText("Bravo")).toBeTruthy();
    fireEvent.click(screen.getByTestId("nav-collapse-all"));
    fireEvent.change(input, { target: { value: "absent" } }); expect(screen.getByText("No board matches")).toBeTruthy();
    fireEvent.change(input, { target: { value: "" } }); expect(screen.getByText("Deep analysis")).toBeTruthy();
  });
  it("container titles match their boards and ancestors", () => {
    const roots = buildContainerTree(containers as never, boards(10));
    const filtered = filterBoardTree(roots, "reSEARCH");
    expect(treeBoards(filtered).map((board) => board.id)).toEqual(["e0"]);
    expect(activeBoardChain(filtered, "e0")).toEqual(["c1", "f1"]);
  });
  it("round-trips explicit open and closed choices per profile", () => {
    const first = renderHook(() => useContainerOpenState("p1", ["c1", "f1", "c2"], []));
    expect(first.result.current.collapsed).toEqual(["c1", "f1", "c2"]);
    act(() => first.result.current.setCollapsed(["c2"])); first.unmount();
    const second = renderHook(() => useContainerOpenState("p1", ["c1", "f1", "c2"], []));
    expect(second.result.current.collapsed).toEqual(["c2"]); second.unmount();
    const other = renderHook(() => useContainerOpenState("p2", ["c1", "f1", "c2"], []));
    expect(other.result.current.collapsed).toEqual(["c1", "f1", "c2"]);
  });
  it("storage throwing does not break rendering or toggles", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Unavailable"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Unavailable"); });
    setup(); fireEvent.click(screen.getByTestId("nav-collapse-all"));
    expect(screen.getByText("Deep analysis")).toBeTruthy();
  });
  it("Recent and find results emit only authorised content-free dims", () => {
    rememberBoardOpen("p1", "e0"); setup();
    fireEvent.click(screen.getByTestId("recent-boards").querySelector("a") as HTMLElement);
    expect(mocks.events).toHaveBeenLastCalledWith("nav.opened", "o1", { item: "recent_board", surface: "sidebar" });
    fireEvent.change(screen.getByRole("textbox", { name: "Find a board" }), { target: { value: "DEEP" } });
    fireEvent.click(screen.getAllByText("Deep analysis").at(-1)?.closest("a") as HTMLElement);
    expect(mocks.events).toHaveBeenLastCalledWith("nav.opened", "o1", { item: "find_result", surface: "sidebar" });
    for (const call of mocks.events.mock.calls) expect(Object.keys(call[2]).sort()).toEqual(["item", "surface"]);
  });
  it("CS-3: a tree board click emits nav.opened item board with the surface, and no title or id", () => {
    for (const surface of ["sidebar", "drawer"] as const) {
      mocks.clientRows = containers; mocks.engagements = boards(10);
      const view = render(<SidebarNav surface={surface} />);
      fireEvent.change(screen.getByRole("textbox", { name: "Find a board" }), { target: { value: "DEEP" } });
      fireEvent.change(screen.getByRole("textbox", { name: "Find a board" }), { target: { value: "" } });
      mocks.events.mockClear();
      const link = Array.from(document.querySelectorAll("a")).find((a) => a.textContent?.includes("Deep analysis") && !a.closest("[data-testid='recent-boards']"));
      fireEvent.click(link as HTMLElement);
      expect(mocks.events).toHaveBeenLastCalledWith("nav.opened", "o1", { item: "board", surface });
      const dims = mocks.events.mock.calls.at(-1)?.[2] as Record<string, unknown>;
      expect(JSON.stringify(dims)).not.toMatch(/Deep analysis|e0/);
      view.unmount();
    }
  });
  it("phone uses the same Recent and Find thresholds and safely handles missing history", () => {
    rememberBoardOpen("p1", "e0");
    const view = render(<BoardFinder profileId="p1" boards={boards(10)} query="" onQueryChange={() => {}} onOpen={() => {}} />);
    expect(screen.getByTestId("recent-boards")).toBeTruthy(); expect(screen.getByRole("textbox", { name: "Find a board" })).toBeTruthy();
    view.rerender(<BoardFinder profileId="p2" boards={boards(5)} query="" onQueryChange={() => {}} onOpen={() => {}} />);
    expect(screen.queryByTestId("recent-boards")).toBeNull(); expect(screen.queryByRole("textbox")).toBeNull();
  });
});
