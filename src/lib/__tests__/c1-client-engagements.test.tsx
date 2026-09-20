// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarNav } from "@/components/layout/SidebarNav";

const mocks = vi.hoisted(() => ({
  profile: {
    id: "p1",
    org_id: "o1",
    role: "worker",
    org_type: "company",
    display_name: "Liam",
  } as Record<string, unknown> | null,
  engagements: [] as unknown[],
  dialogs: [] as { initialClientId?: string | null; from?: string }[],
}));

vi.mock("@/hooks/use-profile", () => ({
  isBusinessOrg: (p: { org_type: string } | null | undefined) => p?.org_type === "company",
  useProfile: () => ({ data: mocks.profile, profiles: mocks.profile ? [mocks.profile] : [] }),
}));
vi.mock("@/hooks/use-engagements", () => ({ useEngagements: () => ({ data: mocks.engagements }) }));
vi.mock("@/hooks/use-decisions", () => ({ useDecisions: () => ({ data: [] }) }));
vi.mock("@/hooks/use-affiliation", () => ({ useAffiliation: () => ({ data: null }) }));
vi.mock("@/hooks/use-coach-note-thread", () => ({ useUnreadNotesAboutMe: () => ({ data: [] }) }));
vi.mock("@/hooks/use-coaching-links", () => ({ useHasLiveCoachLink: () => false }));

vi.mock("@/components/engagements/NewEngagementDialog", () => ({
  NewEngagementDialog: ({
    trigger,
    initialClientId,
    from,
  }: {
    trigger: React.ReactNode;
    initialClientId?: string | null;
    from?: string;
  }) => {
    mocks.dialogs.push({ initialClientId: initialClientId ?? null, from: from ?? "sidebar" });
    return <>{trigger}</>;
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    getQueryCache: () => ({ subscribe: () => () => {} }),
    getQueryData: () => undefined,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params: _params,
    search: _search,
    activeProps: _activeProps,
    activeOptions: _activeOptions,
    children,
    ...rest
  }: Record<string, unknown> & { to: string; children: React.ReactNode }) => (
    <a href={to} {...(rest as Record<string, unknown>)}>
      {children}
    </a>
  ),
  useMatchRoute: () => () => false,
  useSearch: () => ({}),
}));

function engagement(id: string, client: unknown) {
  return { id, code: `C-${id}`, title: `Work ${id}`, clients: client };
}

afterEach(() => {
  cleanup();
  mocks.dialogs = [];
});

describe("C1 new engagement from a client", () => {
  it("shows the plus only on real client shelves", () => {
    mocks.engagements = [
      engagement("a", { id: "cl1", name: "Northwind", quick_folder: false }),
      engagement("b", { id: "cl2", name: "Folderish", quick_folder: true }),
      engagement("c", null),
    ];
    render(<SidebarNav />);
    expect(screen.getByLabelText("New engagement in Northwind")).toBeTruthy();
    expect(screen.queryByLabelText("New engagement in Internal")).toBeNull();
    expect(screen.queryByLabelText("New engagement in Unmapped")).toBeNull();
    expect(screen.queryByLabelText("New engagement in Folderish")).toBeNull();
  });

  it("preselects the client and marks where it started", () => {
    mocks.engagements = [engagement("a", { id: "cl1", name: "Northwind", quick_folder: false })];
    render(<SidebarNav />);
    const shelfDialog = mocks.dialogs.find((d) => d.from === "sidebar_client");
    expect(shelfDialog?.initialClientId).toBe("cl1");
    // The plain list action stays as it was.
    expect(mocks.dialogs.some((d) => d.from === "sidebar" && d.initialClientId === null)).toBe(true);
  });
});
