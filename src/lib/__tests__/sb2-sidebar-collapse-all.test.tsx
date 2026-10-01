// @vitest-environment jsdom
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
}));
vi.mock("@tanstack/react-query", () => ({
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
  window.localStorage.clear();
});


const KEY = "lasso.nav.clients";
const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as string[];
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

describe("SB2 descendant helper", () => {
  it("returns every descendant of a 3-deep branch and no siblings", () => {
    const roots = buildContainerTree(rows as never, engs);
    expect(descendantContainerIds(roots, "c1").sort()).toEqual(["f1", "f2"]);
    expect(descendantContainerIds(roots, "f1")).toEqual(["f2"]);
    expect(descendantContainerIds(roots, "c1")).not.toContain("c2");
    expect(descendantContainerIds(roots, "c2")).toEqual([]);
  });
});

describe("SB2 collapse all and cascade", () => {
  const setup = () => {
    mocks.clientRows = rows;
    mocks.engagements = engs;
    return render(<SidebarNav />);
  };

  it("Collapse all stores every id, nested ones included, and the label flips", () => {
    setup();
    const button = screen.getByTestId("nav-collapse-all");
    expect(button.textContent).toBe("Collapse all");
    fireEvent.click(button);
    expect(stored().sort()).toEqual(["c1", "c2", "f1", "f2"]);
    expect(screen.getByTestId("nav-collapse-all").textContent).toBe("Expand all");
    expect(screen.queryByText("Deep board")).toBeNull();
    fireEvent.click(screen.getByTestId("nav-collapse-all"));
    expect(stored()).toEqual([]);
    expect(screen.getByTestId("nav-collapse-all").textContent).toBe("Collapse all");
    expect(screen.getByText("Deep board")).toBeTruthy();
  });

  it("collapsing a parent by its chevron collapses its children; expanding it leaves them collapsed", () => {
    setup();
    const chevron = () => screen.getByText("Acme").closest("[data-drop-zone], div, li")!.parentElement!.querySelector('button[aria-label="Collapse"], button[aria-label="Expand"]') as HTMLButtonElement;
    const acmeChevron = screen.getAllByRole("button", { name: "Collapse" })[0]!;
    fireEvent.click(acmeChevron);
    expect(stored().sort()).toEqual(["c1", "f1", "f2"]);
    expect(stored()).not.toContain("c2");
    void chevron;
    fireEvent.click(screen.getAllByRole("button", { name: "Expand" })[0]!);
    expect(stored().sort()).toEqual(["f1", "f2"]);
    expect(screen.queryByText("Deep board")).toBeNull();
    expect(screen.getByText("Phase one")).toBeTruthy();
  });

  it("hides the control when the tree is empty", () => {
    render(<SidebarNav />);
    expect(screen.queryByTestId("nav-collapse-all")).toBeNull();
  });
});
