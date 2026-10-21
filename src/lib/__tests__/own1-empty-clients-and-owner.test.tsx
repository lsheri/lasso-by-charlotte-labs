// @vitest-environment jsdom
/**
 * OWN-1: the three presentation rules that pair with the owner_id runbook.
 *
 * 1. A client folder with no visible board anywhere inside it is pruned from
 *    the sidebar tree, while the picker still lists every client.
 * 2. The create-client control is admin-only (the matrix lives in
 *    unit4c-client-mint-gate; here the picker side is pinned).
 * 3. The Share dialog disables Remove on the owner's row, with the reason as
 *    its title, instead of letting the database refusal fire on click.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildContainerTree, pruneEmptyContainers, type ContainerRow, type NavEngagement } from "@/lib/nav-groups";

const board = (id: string, clientId: string | null): NavEngagement => ({
  id,
  code: id.toUpperCase(),
  title: `Board ${id}`,
  ...(clientId
    ? { clients: { id: clientId, name: clientId, quick_folder: false, kind: "client" as const, parent_id: null } }
    : {}),
});

describe("pruneEmptyContainers", () => {
  const rows: ContainerRow[] = [
    { id: "empty", name: "Empty client", kind: "client", parent_id: null },
    { id: "full", name: "Full client", kind: "client", parent_id: null },
    { id: "parent", name: "Parent client", kind: "client", parent_id: null },
    { id: "child", name: "Child folder", kind: "folder", parent_id: "parent" },
    { id: "hollow", name: "Hollow client", kind: "client", parent_id: null },
    { id: "hollow-child", name: "Empty folder", kind: "folder", parent_id: "hollow" },
  ];

  it("drops a client with no visible board, keeps one with a board", () => {
    const roots = buildContainerTree(rows, [board("b1", "full")]);
    const pruned = pruneEmptyContainers(roots);
    const names = pruned.map((node) => node.name);
    expect(names).toContain("Full client");
    expect(names).not.toContain("Empty client");
  });

  it("keeps a client whose only board sits in a folder beneath it", () => {
    const roots = buildContainerTree(rows, [
      { ...board("b2", "child"), clients: { id: "child", name: "Child folder", quick_folder: false, kind: "folder", parent_id: "parent" } },
    ]);
    const pruned = pruneEmptyContainers(roots);
    const parent = pruned.find((node) => node.name === "Parent client");
    expect(parent).toBeTruthy();
    expect(parent?.children.map((node) => node.name)).toContain("Child folder");
  });

  it("drops a client whose subtree holds only empty folders", () => {
    const roots = buildContainerTree(rows, [board("b1", "full")]);
    const pruned = pruneEmptyContainers(roots);
    expect(pruned.map((node) => node.name)).not.toContain("Hollow client");
  });
});

/* ---- The picker stays complete while the sidebar is filtered ---- */

const pickerMocks = vi.hoisted(() => ({
  profile: { org_type: "company", role: "lead", org_id: "org-1", clients_enabled: true } as {
    org_type: "company" | "personal" | "edu";
    role: string;
    org_id: string;
    clients_enabled?: boolean;
  },
  clients: [
    { id: "empty", name: "Empty client", code: null, quick_folder: false, kind: "client" as const, parent_id: null },
    { id: "full", name: "Full client", code: null, quick_folder: false, kind: "client" as const, parent_id: null },
  ],
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: pickerMocks.profile, profiles: [pickerMocks.profile] }),
  ensureProfileState: async () => ({ profiles: [{ id: "p1", org_id: "org1" }], hasDeactivated: false }),
}));
vi.mock("@/hooks/use-clients", () => ({
  createClient: vi.fn(),
  renameClient: vi.fn(),
  useClients: () => ({ data: pickerMocks.clients }),
  useInvalidateClients: () => vi.fn(),
}));

import { ClientPicker } from "@/components/engagements/ClientPicker";

describe("the client picker stays complete", () => {
  afterEach(cleanup);

  it("lists a client with no boards, because that is how it gets its first", () => {
    pickerMocks.profile = { org_type: "company", role: "lead", org_id: "org-1", clients_enabled: true };
    render(<ClientPicker orgId="org-1" value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "Empty client" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Full client" })).toBeTruthy();
  });

  it("hides the create-client control from a non-admin but keeps the list", () => {
    pickerMocks.profile = { org_type: "company", role: "lead", org_id: "org-1", clients_enabled: true };
    render(<ClientPicker orgId="org-1" value={null} onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "New client" })).toBeNull();
    expect(screen.getByRole("option", { name: "Empty client" })).toBeTruthy();
  });

  it("shows the create-client control to an admin", () => {
    pickerMocks.profile = { org_type: "company", role: "admin", org_id: "org-1", clients_enabled: true };
    render(<ClientPicker orgId="org-1" value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "New client" })).toBeTruthy();
  });
});

/* ---- The Share dialog never offers to remove the owner ---- */

const shareMocks = vi.hoisted(() => ({
  setAccess: vi.fn(async (_input: unknown) => ({ status: "done", result: "granted" })),
}));

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/hooks/use-profile", () => ({
  ensureProfileState: async () => ({ profiles: [{ id: "p1", org_id: "org1" }], hasDeactivated: false }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/components/canvas-lab/ShareBoardDialog", () => ({ BoardLinkSection: () => null }));
vi.mock("@/lib/board-invites.functions", () => ({
  inviteToBoard: vi.fn(),
  listBoardInvites: vi.fn(async () => []),
  withdrawBoardInvite: vi.fn(),
}));
vi.mock("@/lib/engagement-access.functions", () => ({
  listEngagementPeopleFn: vi.fn(async () => ({
    canShare: true,
    ownerId: "p3",
    people: [
      { id: "p1", display_name: "Liam", access: "work", isYou: true, email: "liam@co.com" },
      { id: "p3", display_name: "Ben Ode", access: "work", isYou: false, email: "ben@co.com", conversations: "full" },
      { id: "p4", display_name: "Ana Ruiz", access: "review", isYou: false, email: "ana@co.com", conversations: "summaries" },
    ],
  })),
  setEngagementPersonAccessFn: shareMocks.setAccess,
  setPersonConversationsFn: vi.fn(async () => ({ status: "done", result: "changed" })),
}));
vi.mock("@/lib/partner-share", () => ({
  getBoardConversationAccess: vi.fn(), listMyPartnerShares: vi.fn(async () => []),
  setBoardConversationAccess: vi.fn(), listSharedEngagements: vi.fn(async () => []),
  partnerShareLabel: () => "", shareEngagement: vi.fn(), unshareEngagement: vi.fn(),
}));

import { ShareDialog } from "@/components/canvas-lab/ShareDialog";

describe("the owner row in the Share dialog", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("disables Remove on the owner's row with the reason as its title", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ShareDialog engagementId="e1" profileId="p1" />
      </QueryClientProvider> as ReactNode,
    );
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    const list = await screen.findByRole("list", { name: "Who has access" });
    await waitFor(() => expect(within(list).getByText("Ben Ode")).toBeTruthy());

    const ownerRow = within(list).getByText("Ben Ode").closest("li") as HTMLElement;
    const ownerRemove = within(ownerRow).getByRole("button", { name: "Remove" });
    expect(ownerRemove).toHaveProperty("disabled", true);
    expect(ownerRemove.getAttribute("title")).toBe(
      "The owner of a board cannot be removed from it. Archive the board instead.",
    );

    const memberRow = within(list).getByText("Ana Ruiz").closest("li") as HTMLElement;
    const memberRemove = within(memberRow).getByRole("button", { name: "Remove" });
    expect(memberRemove).toHaveProperty("disabled", false);
    expect(memberRemove.getAttribute("title")).toBeNull();
  });
});
