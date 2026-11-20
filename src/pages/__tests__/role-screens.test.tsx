// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { boardsBelow, navFor, type NavCtx } from "@/components/layout/nav-config";
import { DEFAULT_VOCAB } from "@/lib/edu-vocab";
import { DESK_COPY, deskViewFromSearch, type DeskList, type DeskProposal } from "@/lib/proposal-desk-shared";
import { FIRM_BRAIN_COPY, FIRM_VIEW_COPY, HOME_PROPOSALS_COPY, firmBrainAccess, homeShowsProposals } from "@/lib/role-screens-shared";

/**
 * 19 Nov 2026 (Liam): the menu rows and Home, role by role. Each role sees a row only for what it can use, the map
 * stays with admins and leads, an admin's Home leads with the proposals picture, and everyone else's Home is as it
 * was. The edge cases come from the role screens canvas.
 */

type TestProfile = { id: string; org_id: string; role: string; org_type: string; has_firm_view?: boolean; is_guest?: boolean };

const mocks = vi.hoisted(() => ({
  profile: undefined as undefined | null | Record<string, unknown>,
  list: vi.fn(),
  firmDashboard: vi.fn((_id?: string) => ({ data: undefined, isLoading: true, error: null })),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className, search }: { children: ReactNode; to: string; className?: string; search?: Record<string, string> }) => (
    <a href={search && Object.keys(search).length ? `${to}?${new URLSearchParams(search)}` : to} className={className}>{children}</a>
  ),
  useNavigate: () => () => {},
}));
vi.mock("@/hooks/use-profile", async (original) => ({ ...(await original<object>()), useProfile: () => ({ data: mocks.profile }) }));
vi.mock("@/lib/proposal-desk.functions", () => ({ listProposalsFn: mocks.list }));
vi.mock("@/hooks/use-firm-dashboard", () => ({ useFirmDashboard: mocks.firmDashboard }));
// The parts each page is made from are tested in their own files. Here they are named boxes, so order and presence show.
vi.mock("@/components/firm-brain/AskTheFirm", () => ({ AskTheFirm: ({ profile }: { profile: { role?: string } }) => <div data-testid="ask-the-firm" data-role={profile?.role} /> }));
vi.mock("@/components/firm-brain/JuniorTools", () => ({ JuniorTools: () => <div data-testid="junior-tools" /> }));
vi.mock("@/components/firm-brain/FirmBrainMap", () => ({ FirmBrainMap: () => <div data-testid="firm-brain-map" /> }));
vi.mock("@/components/firm-brain/FirmBrainCanvas", () => ({ FirmBrainCanvas: ({ profile }: { profile: { role?: string } }) => <div data-testid="firm-brain-canvas" data-role={profile?.role} /> }));
vi.mock("@/components/firm-brain/CommonQuestionsCard", () => ({ CommonQuestionsCard: () => null }));
vi.mock("@/components/home/HomeBoard", () => ({ HomeBoard: ({ hero }: { hero?: ReactNode }) => <div data-testid="home-board">{hero}</div> }));
vi.mock("@/components/home/HomeAsk", () => ({ HomeAsk: ({ role, recentBoard }: { role?: string; recentBoard?: string | null }) => <div data-testid="home-ask" data-role={role} data-recent={recentBoard ?? ""} /> }));
vi.mock("@tanstack/react-start", async (original) => ({ ...(await original<object>()), useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/firm-map.functions", () => ({ getFirmMap: vi.fn(() => new Promise(() => {})) }));
vi.mock("@/lib/firm-ask.functions", () => ({ askTheFirm: vi.fn(), previewFirmSource: vi.fn(), keepOutOfFirmAnswers: vi.fn() }));
vi.mock("@/hooks/use-engagements", () => ({ useEngagements: () => ({ data: [{ id: "e1", title: "Older board" }, { id: "e2", title: "Fairhaven digital product operating model" }] }) }));
vi.mock("@/hooks/use-engagement-views", () => ({ useEngagementViews: () => ({ data: [{ engagement_id: "e1", last_viewed_at: "2026-11-01T00:00:00Z" }, { engagement_id: "e2", last_viewed_at: "2026-11-20T00:00:00Z" }] }) }));
vi.mock("@/components/person/UsesHomeCard", () => ({ UsesHomeCard: () => null }));

import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { FirmBrainPage } from "@/pages/FirmBrainPage";
import { FirmDashboardPage } from "@/pages/FirmDashboardPage";
import { HomePage } from "@/pages/HomePage";

const person = (role: string, over: Partial<TestProfile> = {}): TestProfile => ({ id: "11111111-1111-4111-8111-111111111111", org_id: "org-1", role, org_type: "company", has_firm_view: true, ...over });
const NOW = Date.now();
const proposal = (over: Partial<DeskProposal>): DeskProposal => ({
  id: "p", title: "Network redesign", clientName: "Pellham", ownerName: "Harper Quinn", mine: false, status: "open",
  receivedAt: new Date(NOW - 2 * 3_600_000).toISOString(), sentAt: null, decidedAt: null, engagementId: null, contextCount: 2, canAct: true, canClose: true, canArchive: true, leadName: null, ask: null, ...over,
});
const desk = (proposals: DeskProposal[]): DeskList => ({ goalHours: 72, canSetGoal: true, canPickLead: true, canAddClient: true, texts: { demo: true, connected: false }, proposals });

function mount(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
const order = (...ids: string[]) => ids.map((id) => Array.from(document.querySelectorAll("[data-testid]")).findIndex((node) => node.getAttribute("data-testid") === id));

afterEach(() => {
  cleanup();
  mocks.profile = undefined;
  mocks.list.mockReset();
  mocks.firmDashboard.mockClear();
});

describe("menu rows by role", () => {
  const base = { canReview: false, hasCoachLink: false, affiliated: false, clientsEnabled: true, workItemCount: 3 };
  const ctx = (type: NavCtx["type"], role: string): NavCtx => ({
    ...base, type, role,
    canManageMembers: role === "admin" || role === "lead",
    canSeeFirmView: type === "company" && (role === "admin" || role === "lead"),
  });
  const main = (type: NavCtx["type"], role: string) =>
    navFor(ctx(type, role), { vocab: DEFAULT_VOCAB, institutionName: null })
      .filter((group) => group.placement === "main")
      .flatMap((group) => (group.id === "engagements" ? ["# Boards"] : group.items.map((item) => `${item.label} -> ${item.to ?? "button"}`)));

  it("an admin and a lead see Firm brain, Proposals and Firm view", () => {
    expect(main("company", "lead")).toEqual(["Home -> /home", "Create -> button", "Firm brain -> /firm-brain", "Proposals -> /proposals", "# Boards", "All work -> /work", "Look back -> /archive", "Your coach -> /one-on-one", "Firm view -> /firm"]);
    // D-82: an admin's boards move to the foot of the menu, in a section that starts closed.
    expect(main("company", "admin")).toEqual(["Home -> /home", "Create -> button", "Firm brain -> /firm-brain", "Proposals -> /proposals", "All work -> /work", "Look back -> /archive", "Your coach -> /one-on-one", "Firm view -> /firm", "# Boards"]);
  });

  it("puts Boards in a lower, closed section for an admin of a company workspace only (D-82)", () => {
    const boards = (type: NavCtx["type"], role: string) =>
      navFor(ctx(type, role), { vocab: DEFAULT_VOCAB, institutionName: null }).find((group) => group.id === "engagements");
    expect(boards("company", "admin")?.lower).toBe(true);
    for (const role of ["lead", "em", "manager", "analyst", "coach"]) expect(boards("company", role)?.lower, role).toBeUndefined();
    for (const type of ["personal", "partner", "edu"] as const) expect(boards(type, "admin")?.lower, type).toBeUndefined();
    expect(boardsBelow({ type: "company", role: "admin" })).toBe(true);
    expect(boardsBelow({ type: "partner", role: "admin" })).toBe(false);
  });

  it("a manager and an analyst see Firm brain and Proposals, and no Firm view row to be refused at", () => {
    for (const role of ["em", "manager", "analyst"]) {
      const rows = main("company", role);
      expect(rows.slice(0, 5)).toEqual(["Home -> /home", "Create -> button", "Firm brain -> /firm-brain", "Proposals -> /proposals", "# Boards"]);
      expect(rows).not.toContain("Firm view -> /firm");
    }
  });

  it("keeps both rows above Boards, so a long list of clients cannot push them out of sight", () => {
    const rows = main("company", "analyst");
    expect(rows.indexOf("Firm brain -> /firm-brain")).toBeLessThan(rows.indexOf("# Boards"));
    expect(rows.indexOf("Proposals -> /proposals")).toBeLessThan(rows.indexOf("# Boards"));
  });

  it("shows neither row to a coach, or in a workspace that is not a company", () => {
    const every = (type: NavCtx["type"], role: string) => navFor(ctx(type, role), { vocab: DEFAULT_VOCAB, institutionName: null }).flatMap((group) => group.items.map((item) => item.id));
    expect(every("company", "coach")).not.toContain("firm-brain");
    expect(every("company", "coach")).not.toContain("proposals");
    for (const type of ["personal", "partner", "edu"] as const) {
      for (const role of ["admin", "lead", "em"]) {
        expect(every(type, role)).not.toContain("firm-brain");
        expect(every(type, role)).not.toContain("proposals");
        expect(every(type, role)).not.toContain("firm-view");
      }
    }
  });

  it("uses plain words for the rows, with no dash", () => {
    const labels = navFor(ctx("company", "admin"), { vocab: DEFAULT_VOCAB, institutionName: null }).flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toContain("Firm brain");
    for (const words of [...labels, ...Object.values(FIRM_BRAIN_COPY), FIRM_VIEW_COPY.adminsAndLeads, FIRM_VIEW_COPY.openFirmBrain, HOME_PROPOSALS_COPY.open, HOME_PROPOSALS_COPY.seeAll(4)]) {
      expect(words).not.toMatch(/[—–]/);
      expect(words.toLowerCase()).not.toMatch(/audit|surveil|monitor|track|harvey/);
    }
  });
});

describe("who gets what", () => {
  it("gives the map to admins and leads, the tools to everyone else in the firm, and nothing to a coach, a guest or another kind of workspace", () => {
    expect(firmBrainAccess(person("admin"))).toBe("map");
    expect(firmBrainAccess(person("lead"))).toBe("map");
    // D-85: members see the map too. Fees are kept from them on the server.
    expect(firmBrainAccess(person("em"))).toBe("map");
    expect(firmBrainAccess(person("coach"))).toBe("none");
    expect(firmBrainAccess(person("admin", { is_guest: true }))).toBe("none");
    expect(firmBrainAccess(person("admin", { org_type: "personal", has_firm_view: false }))).toBe("none");
    expect(firmBrainAccess(person("admin", { org_type: "partner", has_firm_view: false }))).toBe("none");
    // The workspace's own switch wins over its type.
    expect(firmBrainAccess(person("admin", { has_firm_view: false }))).toBe("none");
    expect(firmBrainAccess(null)).toBe("none");
    expect(firmBrainAccess(undefined)).toBe("none");
  });

  it("puts proposals on Home for an admin of a company workspace and for nobody else", () => {
    expect(homeShowsProposals(person("admin"))).toBe(true);
    for (const role of ["lead", "em", "manager", "analyst", "coach", ""]) expect(homeShowsProposals(person(role))).toBe(false);
    expect(homeShowsProposals(person("admin", { is_guest: true }))).toBe(false);
    expect(homeShowsProposals(person("admin", { org_type: "personal", has_firm_view: false }))).toBe(false);
    expect(homeShowsProposals(person("admin", { has_firm_view: false }))).toBe(false);
    expect(homeShowsProposals(null)).toBe(false);
  });
});

describe("the Firm brain page", () => {
  it("shows everyone in the firm the canvas, the one place the map, the question and the tools live (D-85)", () => {
    for (const role of ["admin", "lead", "em"]) {
      mocks.profile = person(role);
      mount(<FirmBrainPage />);
      expect(screen.getByTestId("firm-brain-canvas").getAttribute("data-role")).toBe(role);
      // One title only, drawn by the canvas: the page adds no header or card of its own.
      expect(screen.queryByText(FIRM_BRAIN_COPY.subtitle)).toBeNull();
      expect(screen.queryByTestId("firm-brain-map")).toBeNull();
      expect(screen.queryByTestId("ask-the-firm")).toBeNull();
      expect(screen.queryByTestId("firm-brain-not-here")).toBeNull();
      cleanup();
    }
  });

  it("tells a coach, a guest and a person in another kind of workspace in one plain line, with nothing else on the page", () => {
    const cases: [TestProfile, string][] = [
      [person("coach"), FIRM_BRAIN_COPY.notHereCoach],
      [person("admin", { is_guest: true }), FIRM_BRAIN_COPY.notHere],
      [person("admin", { org_type: "personal", has_firm_view: false }), FIRM_BRAIN_COPY.notHere],
    ];
    for (const [profile, line] of cases) {
      mocks.profile = profile;
      mount(<FirmBrainPage />);
      expect(screen.getByText(line)).toBeTruthy();
      for (const id of ["firm-brain-canvas", "firm-brain-map", "ask-the-firm", "junior-tools"]) expect(screen.queryByTestId(id)).toBeNull();
      cleanup();
    }
  });

  it("shows no refusal and no tools while the person is still loading", () => {
    mocks.profile = undefined;
    mount(<FirmBrainPage />);
    expect(screen.queryByTestId("firm-brain-not-here")).toBeNull();
    for (const id of ["firm-brain-canvas", "firm-brain-map", "ask-the-firm", "junior-tools"]) expect(screen.queryByTestId(id)).toBeNull();
  });
});

describe("Firm view by its address", () => {
  it("tells a manager and an analyst it is for admins and leads, and points to Firm brain", () => {
    for (const role of ["em", "manager", "analyst"]) {
      mocks.profile = person(role);
      mount(<FirmDashboardPage />);
      expect(screen.getByText(FIRM_VIEW_COPY.adminsAndLeads)).toBeTruthy();
      expect(screen.queryByText(FIRM_VIEW_COPY.noFirmView)).toBeNull();
      expect(screen.getByRole("link", { name: FIRM_VIEW_COPY.openFirmBrain }).getAttribute("href")).toBe("/firm-brain");
      // Nothing of the firm's numbers is asked for on their behalf.
      expect(mocks.firmDashboard.mock.calls.every(([id]) => id === undefined)).toBe(true);
      expect(screen.queryByTestId("firm-brain-map")).toBeNull();
      cleanup();
      mocks.firmDashboard.mockClear();
    }
  });

  it("tells a coach the same line with no button, and keeps the old line in a workspace with no firm view", () => {
    mocks.profile = person("coach");
    mount(<FirmDashboardPage />);
    expect(screen.getByText(FIRM_VIEW_COPY.adminsAndLeads)).toBeTruthy();
    expect(screen.queryByRole("link", { name: FIRM_VIEW_COPY.openFirmBrain })).toBeNull();
    cleanup();

    mocks.profile = person("admin", { org_type: "personal", has_firm_view: false });
    mount(<FirmDashboardPage />);
    expect(screen.getByText(FIRM_VIEW_COPY.noFirmView)).toBeTruthy();
    expect(screen.queryByRole("link", { name: FIRM_VIEW_COPY.openFirmBrain })).toBeNull();
  });
});

describe("Home by role", () => {
  it("gives an admin only the operating picture: no Ask the firm, no tools, no boards (D-82)", async () => {
    mocks.profile = person("admin");
    mocks.list.mockResolvedValue(desk([proposal({ id: "a" })]));
    mount(<HomePage />);
    expect(screen.getByTestId("admin-home")).toBeTruthy();
    for (const id of ["ask-the-firm", "junior-tools", "home-board", "home-ask"]) expect(screen.queryByTestId(id)).toBeNull();
    expect(screen.getByRole("link", { name: /Up next in Proposals/ }).getAttribute("href")).toBe("/proposals");
    await waitFor(() => expect(mocks.list).toHaveBeenCalled());
    expect(mocks.list.mock.calls[0]?.[0]).toMatchObject({ data: { profile_id: person("admin").id } });
  });

  it("gives a lead and a member the mini firm brain over their boards, with no proposals asked for (D-85 PR B)", async () => {
    for (const role of ["lead", "em"]) {
      mocks.profile = person(role);
      mount(<HomePage />);
      const ask = screen.getByTestId("home-ask");
      expect(ask.getAttribute("data-role")).toBe(role);
      // The starters are made from the most recently opened board.
      expect(ask.getAttribute("data-recent")).toBe("Fairhaven digital product operating model");
      // The question box sits at the top of Home's board, above the boards as cards.
      expect(screen.getByTestId("home-board").contains(ask)).toBe(true);
      for (const id of ["home-proposals", "ask-the-firm", "junior-tools"]) expect(screen.queryByTestId(id)).toBeNull();
      await Promise.resolve();
      expect(mocks.list).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("leaves Home as it was for a coach and outside a company workspace", () => {
    for (const profile of [person("coach"), person("em", { org_type: "personal", has_firm_view: false })]) {
      mocks.profile = profile;
      mount(<HomePage />);
      expect(screen.queryByTestId("home-ask")).toBeNull();
      expect(screen.getByTestId("home-board")).toBeTruthy();
      cleanup();
    }
  });

  it("shows nothing of proposals while the person is loading, or to a guest seat", () => {
    for (const profile of [undefined, null, person("admin", { is_guest: true })]) {
      mocks.profile = profile;
      mount(<HomePage />);
      expect(screen.queryByTestId("admin-home")).toBeNull();
      expect(mocks.list).not.toHaveBeenCalled();
      cleanup();
    }
  });
});

describe("the Proposals page's list", () => {
  it("leaves the Proposals page's own list whole: no limit, no link to itself", () => {
    const many = Array.from({ length: 6 }, (_, index) => proposal({ id: `p${index}` }));
    render(<ProposalDesk data={desk(many)} />);
    expect(document.querySelectorAll("[data-proposal-row]")).toHaveLength(6);
    expect(document.querySelector("[data-desk-more]")).toBeNull();
  });

  it("opens the Proposals page's list on the view a Home link named, and on All open for anything else", () => {
    const rows = [proposal({ id: "o" }), proposal({ id: "w", status: "won", decidedAt: "2026-11-20T09:00:00Z" })];
    render(<ProposalDesk data={desk(rows)} initialView="won" />);
    expect(screen.getByRole("button", { name: "Won 1" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[data-proposal-row="w"]')).toBeTruthy();
    expect(deskViewFromSearch("won")).toBe("won");
    expect(deskViewFromSearch("mine")).toBe("mine");
    for (const junk of ["open", "everything", "", null, undefined, 3, { view: "won" }]) expect(deskViewFromSearch(junk)).toBeNull();
  });
});
