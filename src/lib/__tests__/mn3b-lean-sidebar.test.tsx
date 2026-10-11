// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navFor, type NavCtx } from "@/components/layout/nav-config";
import { vocabFor } from "@/lib/edu-vocab";
import type { Profile } from "@/hooks/use-profile";

const state = vi.hoisted(() => ({ type: "company", role: "admin", count: 1, work: 0, clients: true, review: false, unread: 0, events: vi.fn(), settings: vi.fn(), navigate: vi.fn(), reset: vi.fn(), setActive: vi.fn(async () => true) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, search, hash, activeProps, activeOptions, ...props }: Record<string, any>) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => state.navigate,
  useRouter: () => ({ navigate: state.navigate }),
  useRouterState: () => "/home",
  useMatchRoute: () => () => false,
  useSearch: () => ({}),
}));
vi.mock("@/hooks/use-profile", async (original) => ({ ...(await original<object>()),
  setActiveProfileId: state.setActive,
  useProfile: () => ({ data: profile(), profiles: makeProfiles() }),
}));
vi.mock("@/components/layout/use-nav-ctx", () => ({ useNavCtx: () => ({
  ctx: context(), profile: profile(), profiles: makeProfiles(), institution: null,
  guestNav: state.role === "coach", vocab: vocabFor(profile()), labels: { vocab: vocabFor(profile()), institutionName: null },
}) }));
vi.mock("@/hooks/use-engagements", () => ({ useEngagements: () => ({ data: [] }) }));
vi.mock("@/hooks/use-clients", () => ({ useClients: () => ({ data: [] }), useInvalidateClients: () => () => {} }));
vi.mock("@/hooks/use-decisions", () => ({ useDecisions: () => ({ data: [] }) }));
vi.mock("@/hooks/use-work-items", () => ({ useWorkItems: () => ({ data: { items: Array.from({ length: state.work }, (_, i) => ({ id: `w${i}`, visibility: "mapped" })) } }) }));
vi.mock("@/hooks/use-coach-note-thread", () => ({ useUnreadNotesAboutMe: () => ({ data: Array.from({ length: state.unread }, (_, i) => ({ id: `n${i}` })) }) }));
vi.mock("@/hooks/use-shared-with-me", () => ({ useSharedWithMe: () => ({ groups: [] }) }));
vi.mock("@/hooks/use-shared-board-marks", () => ({ useSharedBoardMarks: () => new Map() }));
vi.mock("@/components/engagements/NewEngagementDialog", () => ({ NewEngagementDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</> }));
vi.mock("@/components/engagements/SidebarCreateActions", () => ({ SidebarCreateActions: () => null }));
vi.mock("@/components/feedback/FeedbackWidget", () => ({ FeedbackDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</> }));
vi.mock("@/lib/settings-dialog-context", () => ({ useSettingsDialogOptional: () => ({ openSettings: state.settings }) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: state.events, bucket: () => "0" }));
vi.mock("@/lib/posthog-client", () => ({ resetPostHog: state.reset }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: async () => ({}) } } }));

import { WorkspaceMenu } from "@/components/layout/WorkspaceMenu";
import { SidebarNav } from "@/components/layout/SidebarNav";

function profile(): Profile {
  return { id: "p1", user_id: "u1", org_id: "o1", org_name: "Northline", org_type: state.type as Profile["org_type"], role: state.role,
    display_name: "Liam", title_band: null, clients_enabled: state.clients, onboarding: null };
}
function makeProfiles(): Profile[] { return state.count === 1 ? [profile()] : [profile(), { ...profile(), id: "p2", org_id: "o2", org_name: "Bright Path" }]; }
function context(): NavCtx {
  return { type: profile().org_type, role: state.role, canReview: state.review, canManageMembers: ["admin", "lead"].includes(state.role),
    canSeeFirmView: state.type === "company" && ["admin", "lead"].includes(state.role), hasCoachLink: false, affiliated: false, clientsEnabled: state.clients, workItemCount: state.work };
}
function mount(children: ReactNode) { return render(<QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>); }
function openMenu() { fireEvent.click(screen.getByRole("button", { name: /Change workspace/ })); return screen.getByRole("menu"); }
vi.mock("@/components/coaching/CoachAskSheet", () => ({ CoachAskSheet: () => null }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
import { MobileTabBar } from "@/components/layout/MobileTabBar";

function rows(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll(".nb-group-header, a")).map((node) =>
    node.classList.contains("nb-group-header") ? `# ${node.textContent?.trim()}` : `${node.textContent?.replace(/\s+/g, " ").trim()} -> ${node.getAttribute("href")}`);
}
function sidebarRows() { const view = mount(<SidebarNav />); const out = rows(view.container); view.unmount(); return out; }
function menuIds() { const view = mount(<WorkspaceMenu />); const out = Array.from(openMenu().querySelectorAll("[data-nav-item]")).map((r) => r.getAttribute("data-nav-item")); view.unmount(); return out; }
function createItems() {
  const view = mount(<SidebarNav />);
  fireEvent.click(screen.getByRole("button", { name: "New workboard, client or folder" }));
  const out = Array.from(screen.getByRole("menu").querySelectorAll("[data-create-item]")).map((r) => r.textContent?.trim());
  view.unmount(); return out;
}
beforeEach(() => { vi.clearAllMocks(); state.type = "company"; state.role = "admin"; state.count = 1; state.work = 0; state.clients = true; state.review = false; state.unread = 0; });
afterEach(cleanup);

const LANDED = ["# What landed", "Home -> /home", "All work -> /work", "All AI Conversations -> /ai-record"];

describe("MN-3b lean sidebar", () => {
  it("company admin with no work: Connect your AI tools shows in the sidebar, not the menu", () => {
    expect(sidebarRows()).toEqual([...LANDED, "Connect your AI tools -> /connectors", "# Where it goes", "Look back -> /archive", "Your coach -> /one-on-one"]);
    expect(menuIds()).toEqual(["firm-view", "members", "settings", "trust", "why", "feedback", "sign-out"]);
  });
  it("company admin with five work items: the sources page moves into the menu after Settings", () => {
    state.work = 5;
    expect(sidebarRows()).toEqual([...LANDED, "# Where it goes", "Look back -> /archive", "Your coach -> /one-on-one"]);
    expect(menuIds()).toEqual(["firm-view", "members", "settings", "connectors", "trust", "why", "feedback", "sign-out"]);
    const view = mount(<WorkspaceMenu />);
    expect(within(openMenu()).getByText("Where work comes from")).toBeTruthy();
    view.unmount();
  });
  it("partner admin never sees Your coach", () => {
    state.type = "partner"; state.work = 5;
    expect(sidebarRows()).toEqual([...LANDED, "# Your clients", "Look back -> /archive"]);
  });
  it("personal admin keeps Who you share with", () => {
    state.type = "personal"; state.work = 5;
    expect(sidebarRows()).toEqual([...LANDED, "# Where it goes", "Look back -> /archive", "# Who you share with", "Your coaches -> /members"]);
  });
  it("edu admin: classes after the tree, then the bottom rows", () => {
    state.type = "edu"; state.work = 5;
    expect(sidebarRows()).toEqual([...LANDED, "# Workboards", "# Your classes", "Classes -> /classes", "Workboards -> /assignments", "Projects -> /projects", "Portfolio -> /portfolio",
      "Look back -> /archive", "Your coach -> /one-on-one", "# Who you share with", "Your coaches -> /members"]);
  });
  it("guest keeps the 1:1 prep row", () => {
    state.role = "coach"; state.review = true;
    expect(sidebarRows()).toEqual(["# Coaching", "People you coach -> /coaching", "# Your account", "1:1 prep -> /one-on-one"]);
  });
  it("People you coach sits between What landed and Where it goes", () => {
    state.role = "em"; state.review = true; state.work = 5;
    expect(sidebarRows()).toEqual([...LANDED, "# Coaching", "People you coach -> /coaching", "# Where it goes", "Look back -> /archive", "Your coach -> /one-on-one"]);
  });
  it("Your coach shows the unread note count only above zero", () => {
    state.unread = 2;
    const view = mount(<SidebarNav />);
    expect(screen.getByRole("link", { name: "Your coach, 2 new notes" }).textContent).toContain("2");
    view.unmount(); state.unread = 0; mount(<SidebarNav />);
    expect(screen.getByRole("link", { name: "Your coach" }).textContent).toBe("Your coach");
  });
  it.each([
    ["company", "admin", true, ["New workboard", "New client", "New folder"]],
    ["company", "admin", false, ["New workboard", "New folder"]],
    ["company", "em", true, ["New workboard", "New folder"]],
    ["partner", "admin", true, ["New workboard", "New client", "New folder"]],
    ["personal", "admin", true, ["New workboard", `New ${vocabFor({ org_type: "personal" }).client.toLowerCase()}`, "New folder"]],
    ["edu", "admin", false, [vocabFor({ org_type: "edu" }).newEngagement, "New folder"]],
  ])("%s %s clients=%s: + menu items", (type, role, clients, expected) => {
    state.type = type as string; state.role = role as string; state.clients = clients as boolean;
    expect(createItems()).toEqual(expected);
    expect(state.events).toHaveBeenCalledWith("nav.opened", "o1", { item: "create_menu", surface: "sidebar" });
  });
  it("Look back, Your coach and Connect your AI tools emit their manifest ids", () => {
    mount(<SidebarNav />);
    for (const [name, item] of [["Look back", "look_back"], ["Your coach", "your_coach"], ["Connect your AI tools", "connect_tools"]] as const) {
      fireEvent.click(screen.getByRole("link", { name }));
      expect(state.events).toHaveBeenLastCalledWith("nav.opened", "o1", { item, surface: "sidebar" });
    }
  });
  it("no Find it or Decision log in the sidebar, the drawer or More", () => {
    const gone = ["Find it", "Decision log", "Past work", "Archived", "Past Ask Lasso chats", "Notes from your coach"];
    const side = mount(<SidebarNav />);
    for (const label of gone) expect(within(side.container).queryByText(label)).toBeNull();
    side.unmount();
    const drawer = mount(<SidebarNav surface="drawer" />);
    for (const label of gone) expect(within(drawer.container).queryByText(label)).toBeNull();
    drawer.unmount();
    mount(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const sheet = screen.getByTestId("sheet");
    for (const label of gone) expect(within(sheet).queryByText(label)).toBeNull();
  });
});
