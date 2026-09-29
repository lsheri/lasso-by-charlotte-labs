// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
vi.mock("@/components/engagements/SidebarCreateActions", () => ({ SidebarCreateActions: () => null }));
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

describe("unit 3c containers render without workboards", () => {
  it("shows an empty client and two nested folders the workboard list never mentions", async () => {
    const clientRows: ContainerRow[] = [
      { id: "c-empty", name: "Lonely Co", kind: "client", parent_id: null },
      { id: "c-top", name: "Top Co", kind: "client", parent_id: null },
      { id: "f-1", name: "Folder One", kind: "folder", parent_id: "c-top" },
      { id: "f-2", name: "Folder Two", kind: "folder", parent_id: "f-1" },
    ];
    mocks.clientRows = clientRows;
    mocks.profile = { id: "p1", org_id: "o1", org_type: "partner", role: "worker" };
    mocks.engagements = [eng("e9", null)];
    const { container } = render(<SidebarNav />);
    for (const name of ["Lonely Co", "Top Co", "Folder One", "Folder Two"]) {
      expect(screen.getAllByText(name)).toHaveLength(1);
    }
    expect(screen.getByText("Not in a client yet")).toBeTruthy();
    expect(screen.getAllByText("Nothing in here yet").length).toBe(2);
    // Order proves nesting: Top Co, then Folder One, then Folder Two.
    const text = container.textContent ?? "";
    expect(text.indexOf("Top Co")).toBeLessThan(text.indexOf("Folder One"));
    expect(text.indexOf("Folder One")).toBeLessThan(text.indexOf("Folder Two"));
    const { flattenForSidebar: flat, buildContainerTree: tree } = await import("@/lib/nav-groups");
    expect(flat(tree(clientRows, [])).map((r) => [r.node.name, r.depth])).toEqual([
      ["Lonely Co", 0],
      ["Top Co", 0],
      ["Folder One", 1],
      ["Folder Two", 2],
    ]);
    mocks.clientRows = [];
  });

  it("renders the live three-level shape on one shared indent scale", () => {
    const clientRows: ContainerRow[] = [
      { id: "abc", name: "ABC co", kind: "client", parent_id: null },
      { id: "folder-01", name: "folder 01", kind: "folder", parent_id: "abc" },
      { id: "folder-1", name: "folder1", kind: "folder", parent_id: "folder-01" },
      { id: "test-a", name: "test", kind: "folder", parent_id: null },
      { id: "test-b", name: "test", kind: "folder", parent_id: null },
    ];
    mocks.clientRows = clientRows;
    mocks.profile = { id: "p1", org_id: "o1", org_type: "partner", role: "worker" };
    mocks.engagements = [
      { ...eng("cure", { id: "abc", name: "ABC co", quick_folder: false, kind: "client", parent_id: null }), code: null, title: "CURE test" },
      { ...eng("b5", { id: "folder-01", name: "folder 01", quick_folder: false, kind: "folder", parent_id: "abc" }), code: null, title: "B5-TEST2 test" },
    ];

    const { container } = render(<SidebarNav />);
    const renderedDepth = (label: string) =>
      Number(screen.getByText(label).closest("[data-tree-depth]")?.getAttribute("data-tree-depth"));

    expect(renderedDepth("ABC co")).toBe(0);
    expect(renderedDepth("CURE test")).toBe(1);
    expect(renderedDepth("folder 01")).toBe(1);
    expect(renderedDepth("B5-TEST2 test")).toBe(2);
    expect(renderedDepth("folder1")).toBe(2);

    const text = container.textContent ?? "";
    expect(text.indexOf("ABC co")).toBeLessThan(text.indexOf("CURE test"));
    expect(text.indexOf("CURE test")).toBeLessThan(text.indexOf("folder 01"));
    expect(text.indexOf("folder 01")).toBeLessThan(text.indexOf("B5-TEST2 test"));
    expect(text.indexOf("B5-TEST2 test")).toBeLessThan(text.indexOf("folder1"));

    const folderRow = screen.getByText("folder 01").closest("[data-tree-node]");
    expect(folderRow).not.toBeNull();
    if (!folderRow) return;
    fireEvent.click(within(folderRow as HTMLElement).getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("B5-TEST2 test")).toBeNull();
    expect(screen.queryByText("folder1")).toBeNull();
    expect(screen.getByText("CURE test")).toBeTruthy();

    mocks.clientRows = [];
  });
});
