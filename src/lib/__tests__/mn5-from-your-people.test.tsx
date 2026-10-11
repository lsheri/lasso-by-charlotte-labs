// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: { id: "p1", org_id: "o1", org_type: "partner", role: "em" } as Record<string, unknown>,
  boards: [] as unknown[],
  pieces: [] as unknown[],
  queries: [] as Array<{ queryKey: unknown[]; enabled?: boolean }>,
  events: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, onClick, to, params }: { children: ReactNode; className?: string; onClick?: () => void; to: string; params?: { boardId: string } }) => (
    <a className={className} onClick={onClick} href={params ? to.replace("$boardId", params.boardId) : to}>{children}</a>
  ),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: { queryKey: unknown[]; enabled?: boolean }) => {
    mocks.queries.push(opts);
    if (opts.queryKey[0] === "partner-shared-boards")
      return { data: opts.enabled === false ? undefined : mocks.boards, isLoading: false };
    return { data: mocks.pieces, isSuccess: true, isLoading: false };
  },
}));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: mocks.profile }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/lib/telemetry", () => ({ logEvent: mocks.events }));
vi.mock("@/components/work/WorkNote", () => ({
  WorkNote: ({ item, onOpen, actions }: { item: { title: string }; onOpen?: unknown; actions?: unknown }) => (
    <article data-readonly={!onOpen && !actions}>{item.title}</article>
  ),
}));

import { FromYourPeopleGroup } from "@/components/layout/FromYourPeople";
import { usePartnerSharedBoards } from "@/hooks/use-partner-shared-boards";
import { PartnerSharedBoardPage, SHARED_BOARD_COPY } from "@/pages/PartnerSharedBoardPage";
import { logEvent } from "@/lib/telemetry";

const BOARDS = [
  { link_id: "l1", shared_by: "Ana Ruiz", board_id: "b1", title: "Market entry", code: "ACM-01" },
  { link_id: "l2", shared_by: "Ben Ode", board_id: "b2", title: "Pricing review", code: "BEN-02" },
  { link_id: "l3", shared_by: "Ana Ruiz", board_id: "b3", title: "Ops model", code: "ACM-03" },
];

afterEach(() => {
  cleanup();
  mocks.boards = [];
  mocks.pieces = [];
  mocks.queries = [];
  mocks.events.mockReset();
  mocks.profile = { id: "p1", org_id: "o1", org_type: "partner", role: "em" };
});

function renderGroup() {
  return render(
    <FromYourPeopleGroup onOpen={() => logEvent("nav.opened", "o1", { item: "from_your_people", surface: "sidebar" })} />,
  );
}

describe("MN-5 From your people", () => {
  it("is absent when the list is empty", () => {
    renderGroup();
    expect(screen.queryByText("From your people")).toBeNull();
  });

  it("is absent outside partner workspaces", () => {
    mocks.profile = { id: "p1", org_id: "o1", org_type: "company", role: "em" };
    mocks.boards = BOARDS;
    renderGroup();
    expect(screen.queryByText("From your people")).toBeNull();
  });

  it("groups by person in order, shows titles and never codes", () => {
    mocks.boards = BOARDS;
    const { container } = renderGroup();
    const text = container.textContent ?? "";
    expect(text.indexOf("Ana Ruiz")).toBeLessThan(text.indexOf("Market entry"));
    expect(text.indexOf("Ops model")).toBeLessThan(text.indexOf("Ben Ode"));
    expect(screen.getAllByText("Ana Ruiz")).toHaveLength(1);
    for (const code of ["ACM-01", "BEN-02", "ACM-03"]) expect(text).not.toContain(code);
  });

  it("opens /shared/$id and fires nav.opened with only item and surface", () => {
    mocks.boards = BOARDS;
    renderGroup();
    const link = screen.getByText("Pricing review").closest("a")!;
    expect(link.getAttribute("href")).toBe("/shared/b2");
    fireEvent.click(link);
    expect(mocks.events).toHaveBeenCalledWith("nav.opened", "o1", { item: "from_your_people", surface: "sidebar" });
    const dims = mocks.events.mock.calls[0]![2] as Record<string, unknown>;
    expect(Object.keys(dims).sort()).toEqual(["item", "surface"]);
  });

  it("the hook is disabled outside partner workspaces", () => {
    mocks.profile = { id: "p1", org_id: "o1", org_type: "company", role: "em" };
    function Probe() { usePartnerSharedBoards(); return null; }
    render(<Probe />);
    const q = mocks.queries.find((entry) => entry.queryKey[0] === "partner-shared-boards")!;
    expect(q.enabled).toBe(false);
    expect(q.queryKey).toEqual(["partner-shared-boards", "p1"]);
  });
});

describe("MN-5 shared board view", () => {
  it("shows the Shared by line and read-only pieces with no edit controls", () => {
    mocks.boards = BOARDS;
    mocks.pieces = [{ id: "w1", title: "Interview notes" }];
    const { container } = render(<PartnerSharedBoardPage boardId="b1" />);
    expect(screen.getByRole("heading", { name: "Market entry" })).toBeTruthy();
    expect(screen.getByText(SHARED_BOARD_COPY.sharedBy("Ana Ruiz"))).toBeTruthy();
    expect(container.querySelector("article")?.getAttribute("data-readonly")).toBe("true");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/ACM-01|move|edit|delete/i);
  });

  it("shows only the no-longer-shared line when the board is absent", () => {
    mocks.boards = BOARDS;
    mocks.pieces = [{ id: "w1", title: "Interview notes" }];
    const { container } = render(<PartnerSharedBoardPage boardId="gone" />);
    expect(container.textContent).toBe(SHARED_BOARD_COPY.ended);
  });

  it("copy holds no em dash", () => {
    expect(SHARED_BOARD_COPY.sharedBy("A") + SHARED_BOARD_COPY.ended).not.toContain("\u2014");
  });
});
