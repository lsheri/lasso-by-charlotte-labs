// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NavEngagement } from "@/lib/nav-groups";

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

// SC1: the sidebar shows the title only. The board code keeps its job
// everywhere else; it must not render in the nav rows any more.
const codedBoard: NavEngagement = {
  id: "e1",
  code: "ABC-01",
  title: "Quarterly margin review",
  clients: { id: "c1", name: "Acme", quick_folder: false, kind: "client", parent_id: null },
};
const quickFolderBoard: NavEngagement = {
  id: "e2",
  code: null,
  title: "Loose board",
  clients: null,
};

describe("SC1 sidebar rows carry no board code", () => {
  it("renders the title and never the code", () => {
    mocks.engagements = [codedBoard];
    render(<SidebarNav />);
    expect(screen.getByText("Quarterly margin review")).toBeTruthy();
    expect(screen.queryByText("ABC-01")).toBeNull();
  });

  it("a quick-folder board does not render the word Folder as a label", () => {
    mocks.engagements = [quickFolderBoard];
    render(<SidebarNav />);
    const row = screen.getByText("Loose board");
    expect(row).toBeTruthy();
    expect(screen.queryByText("Folder")).toBeNull();
  });
});
