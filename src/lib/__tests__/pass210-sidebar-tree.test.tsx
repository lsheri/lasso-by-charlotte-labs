// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_VOCAB, EDU_VOCAB, PERSONAL_VOCAB, splitsByKind } from "@/lib/edu-vocab";
import {
  MAX_CONTAINER_DEPTH,
  MAX_SIDEBAR_CONTAINER_DEPTH,
  buildContainerTree,
  containerRowsFromEngagements,
  flattenForSidebar,
  type ContainerRow,
  type NavEngagement,
} from "@/lib/nav-groups";

const mocks = vi.hoisted(() => ({
  profile: { id: "p1", org_id: "o1", org_type: "company", role: "worker" } as Record<string, unknown>,
  engagements: [] as unknown[],
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
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: mocks.profile, profiles: [mocks.profile] }),
}));
vi.mock("@/hooks/use-engagements", () => ({
  useEngagements: () => ({ data: mocks.engagements }),
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

afterEach(() => cleanup());

const row = (id: string, parent_id: string | null, kind: "client" | "folder" = "client"): ContainerRow => ({
  id,
  name: id,
  kind,
  parent_id,
});

describe("pass 210 flattenForSidebar", () => {
  it("keeps a flat tree at depth 0 in order", () => {
    const flat = flattenForSidebar(buildContainerTree([row("a", null), row("b", null)], []));
    expect(flat.map((r) => [r.node.name, r.depth])).toEqual([
      ["a", 0],
      ["b", 0],
    ]);
  });

  it("clamps a three deep chain without losing anything", () => {
    const rows = [row("a", null), row("b", "a"), row("c", "b"), row("d", "c")];
    const flat = flattenForSidebar(buildContainerTree(rows, []));
    expect(flat).toHaveLength(rows.length);
    expect(flat.map((r) => r.node.name)).toEqual(["a", "b", "c", "d"]);
    expect(Math.max(...flat.map((r) => r.depth))).toBe(MAX_SIDEBAR_CONTAINER_DEPTH);
  });

  it("pins both depth limits", () => {
    expect(MAX_SIDEBAR_CONTAINER_DEPTH).toBe(2);
    expect(MAX_CONTAINER_DEPTH).toBe(3);
  });
});

describe("pass 210 splitsByKind", () => {
  it("splits for company and school, not personal", () => {
    expect(splitsByKind(DEFAULT_VOCAB)).toBe(true);
    expect(splitsByKind(EDU_VOCAB)).toBe(true);
    expect(splitsByKind(PERSONAL_VOCAB)).toBe(false);
  });
});

const eng = (id: string, clients: NavEngagement["clients"]): NavEngagement => ({
  id,
  code: id.toUpperCase(),
  title: `Title ${id}`,
  clients,
});

describe("pass 210 containerRowsFromEngagements", () => {
  it("skips quick folders and nulls, dedupes, defaults kind", () => {
    const rows = containerRowsFromEngagements([
      eng("e1", { id: "c1", name: "Acme", quick_folder: false }),
      eng("e2", { id: "c1", name: "Acme", quick_folder: false }),
      eng("e3", { id: "q1", name: "Quick", quick_folder: true }),
      eng("e4", null),
    ]);
    expect(rows).toEqual([{ id: "c1", name: "Acme", kind: "client", parent_id: null, quick_folder: false }]);
  });
});

describe("pass 210 sidebar rendering", () => {
  const mixed = [
    eng("e1", { id: "c1", name: "Acme", quick_folder: false, kind: "client", parent_id: null }),
    eng("e2", { id: "f1", name: "Research", quick_folder: false, kind: "folder", parent_id: null }),
  ];

  it("shows a Folders header for a company with a folder", () => {
    mocks.profile = { id: "p1", org_id: "o1", org_type: "company", role: "worker" };
    mocks.engagements = mixed;
    render(<SidebarNav />);
    expect(screen.getAllByText("Folders")).toHaveLength(1);
    expect(screen.getAllByText("Research")).toHaveLength(1);
  });

  it("shows no Folders header in a personal workspace", () => {
    mocks.profile = { id: "p1", org_id: "o1", org_type: "personal", role: "worker" };
    mocks.engagements = mixed;
    render(<SidebarNav />);
    expect(screen.queryByText("Folders")).toBeNull();
  });

  it("renders as today when every container is an unparented client", () => {
    mocks.profile = { id: "p1", org_id: "o1", org_type: "company", role: "worker" };
    mocks.engagements = [
      eng("e1", { id: "c1", name: "Acme", quick_folder: false, kind: "client", parent_id: null }),
      eng("e2", { id: "c2", name: "Beta", quick_folder: false, kind: "client", parent_id: null }),
      eng("e3", null),
    ];
    render(<SidebarNav />);
    expect(screen.queryByText("Folders")).toBeNull();
    for (const id of ["e1", "e2", "e3"]) expect(screen.getByText(`Title ${id}`)).toBeTruthy();
  });
});
