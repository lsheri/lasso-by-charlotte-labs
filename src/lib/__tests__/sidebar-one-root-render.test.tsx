// @vitest-environment jsdom
// Liam, 15 Nov: one top-level folder open at a time, in the real sidebar (setup copied from sb2, router mock completed).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildContainerTree, descendantContainerIds, type NavEngagement } from "@/lib/nav-groups";

const mocks = vi.hoisted(() => ({
  profile: { id: "p1", org_id: "o1", org_type: "company", clients_enabled: true, role: "worker" } as Record<string, unknown>,
  engagements: [] as unknown[],
  clientRows: [] as unknown[],
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
  useMatchRoute: () => () => false,
  useSearch: () => ({}),
  useNavigate: () => () => {},
  useRouterState: () => ({ location: { pathname: "/home", hash: "" } }),
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
vi.mock("@/components/layout/SharedWithYou", () => ({ SharedWithYouSection: () => null }));
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
  window.localStorage.clear();
});


const KEY = "lasso.tree_open.p1";
const stored = () => Object.entries(JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, boolean>).filter(([, open]) => !open).map(([id]) => id);
const rows = [
  { id: "c1", name: "Acme", kind: "client", parent_id: null, quick_folder: false },
  { id: "f1", name: "Phase one", kind: "folder", parent_id: "c1", quick_folder: false },
  { id: "f2", name: "Week two", kind: "folder", parent_id: "f1", quick_folder: false },
  { id: "c2", name: "Bravo", kind: "client", parent_id: null, quick_folder: false },
];
const engs: NavEngagement[] = [
  { id: "e1", code: "E1", title: "Deep board", clients: { id: "f2", name: "Week two", quick_folder: false, kind: "folder", parent_id: "f1" } },
  { id: "e2", code: "E2", title: "Bravo board", clients: { id: "c2", name: "Bravo", quick_folder: false, kind: "client", parent_id: null } },
];


const toggleFor = (name: string) => {
  const shelf = screen.getByText(name).closest(".nb-nav-shelf") as HTMLElement;
  return shelf.querySelector<HTMLElement>("button:is([aria-label=Expand], [aria-label=Collapse])")!;
};
const openRoots = () => ["Acme", "Bravo"].filter((name) => toggleFor(name).getAttribute("aria-expanded") === "true");

describe("one top-level folder open at a time, rendered", () => {
  const setup = () => {
    mocks.clientRows = rows;
    mocks.engagements = engs;
    return render(<SidebarNav />);
  };

  it("opening a second root closes the first, and its boards leave the tree", () => {
    setup();
    fireEvent.click(toggleFor("Acme"));
    expect(openRoots()).toEqual(["Acme"]);
    fireEvent.click(toggleFor("Bravo"));
    expect(openRoots()).toEqual(["Bravo"]);
    expect(screen.queryByText("Phase one")).toBeNull();
    expect(screen.getByText("Bravo board")).toBeTruthy();
  });

  it("shows one root when an older session saved two open", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ c1: true, c2: true }));
    setup();
    expect(openRoots()).toHaveLength(1);
  });

  it("offers Collapse all only while something is open, and never Expand all", () => {
    setup();
    expect(screen.queryByText("Expand all")).toBeNull();
    expect(screen.queryByTestId("nav-collapse-all")).toBeNull();
    fireEvent.click(toggleFor("Bravo"));
    fireEvent.click(screen.getByTestId("nav-collapse-all"));
    expect(openRoots()).toEqual([]);
  });
});
