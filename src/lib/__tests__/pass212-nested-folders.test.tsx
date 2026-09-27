// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  containerDepth,
  partitionContainers,
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
vi.mock("@/hooks/use-profile", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useProfile: () => ({ data: mocks.profile, profiles: [mocks.profile] }),
}));
vi.mock("@/hooks/use-engagements", () => ({ useEngagements: () => ({ data: mocks.engagements }) }));
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

const row = (id: string, kind: "client" | "folder", parent_id: string | null): ContainerRow => ({
  id,
  name: id,
  kind,
  parent_id,
});

const eng = (id: string, client: ContainerRow | null): NavEngagement => ({
  id,
  code: id.toUpperCase(),
  title: `Title ${id}`,
  clients: client
    ? { id: client.id, name: client.name, quick_folder: false, kind: client.kind, parent_id: client.parent_id }
    : null,
});

describe("pass 212 partitionContainers", () => {
  it("puts a folder under its visible client and nowhere top level", () => {
    const client = row("client", "client", null);
    const folder = row("folder", "folder", client.id);
    const result = partitionContainers([client, folder], [eng("e1", client), eng("e2", folder)]);
    expect(result.foldersUnderClient.get(client.id)?.map(({ node }) => node.clientId)).toEqual([folder.id]);
    expect(result.topLevelFolders).toEqual([]);
  });

  it("puts a root folder only in the top-level list", () => {
    const folder = row("folder", "folder", null);
    const result = partitionContainers([folder], [eng("e1", folder)]);
    expect(result.topLevelFolders.map(({ node }) => node.clientId)).toEqual([folder.id]);
    expect([...result.foldersUnderClient.values()].flat()).toEqual([]);
  });

  it("puts a coach-visible orphan folder at top level", () => {
    const folder = row("folder", "folder", "hidden-parent");
    const result = partitionContainers([folder], [eng("e1", folder)]);
    expect(result.topLevelFolders.map(({ node }) => node.clientId)).toEqual([folder.id]);
  });

  it("makes depths relative to the visible client", () => {
    const rows = [
      row("client", "client", null),
      row("folder", "folder", "client"),
      row("child", "folder", "folder"),
    ];
    expect(partitionContainers(rows, rows.map((item, index) => eng(`e${index}`, item))).foldersUnderClient
      .get("client")?.map(({ node, depth }) => [node.clientId, depth])).toEqual([
        ["folder", 0],
        ["child", 1],
      ]);
  });

  it("never emits a folder in both outputs", () => {
    const rows = [
      row("client", "client", null),
      row("nested", "folder", "client"),
      row("nested-child", "folder", "nested"),
      row("root", "folder", null),
      row("orphan", "folder", "hidden"),
    ];
    const result = partitionContainers(rows, rows.map((item, index) => eng(`e${index}`, item)));
    const under = [...result.foldersUnderClient.values()].flat().map(({ node }) => node.clientId);
    const top = result.topLevelFolders.map(({ node }) => node.clientId);
    expect(new Set([...under, ...top]).size).toBe(4);
    expect(under.filter((id) => top.includes(id))).toEqual([]);
  });

  it("reports root, child, grandchild and cycle depths without hanging", () => {
    const rows = [
      row("root", "client", null),
      row("child", "folder", "root"),
      row("grandchild", "folder", "child"),
      row("cycle-a", "folder", "cycle-b"),
      row("cycle-b", "folder", "cycle-a"),
    ];
    expect(containerDepth(rows, "root")).toBe(0);
    expect(containerDepth(rows, "child")).toBe(1);
    expect(containerDepth(rows, "grandchild")).toBe(2);
    expect(Number.isFinite(containerDepth(rows, "cycle-a"))).toBe(true);
  });
});

describe("pass 212 sidebar rendering", () => {
  it("renders a nested folder under its client without a Folders header", () => {
    const client = row("client", "client", null);
    const folder = row("folder", "folder", client.id);
    mocks.engagements = [eng("client-work", client), eng("folder-work", folder)];
    render(<SidebarNav />);
    expect(screen.getByText("folder")).toBeTruthy();
    expect(screen.getByText("Title folder-work")).toBeTruthy();
    expect(screen.queryByText("Folders")).toBeNull();
  });

  it("keeps the all-root-client production shape unchanged", () => {
    const acme = { ...row("c1", "client", null), name: "Acme" };
    const beta = { ...row("c2", "client", null), name: "Beta" };
    mocks.engagements = [eng("e1", acme), eng("e2", beta), eng("e3", null)];
    render(<SidebarNav />);
    expect(screen.queryByText("Folders")).toBeNull();
    for (const id of ["e1", "e2", "e3"]) expect(screen.getByText(`Title ${id}`)).toBeTruthy();
  });
});