// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navFor, type NavCtx } from "@/components/layout/nav-config";
import { vocabFor } from "@/lib/edu-vocab";
import type { Profile } from "@/hooks/use-profile";

const state = vi.hoisted(() => ({ type: "company", role: "admin", count: 2, events: vi.fn(), settings: vi.fn(), navigate: vi.fn(), reset: vi.fn(), setActive: vi.fn(async () => true) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, search, hash, activeProps, activeOptions, ...props }: Record<string, any>) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => state.navigate,
  useRouter: () => ({ navigate: state.navigate }),
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
vi.mock("@/hooks/use-work-items", () => ({ useWorkItems: () => ({ data: { items: [] } }) }));
vi.mock("@/hooks/use-coach-note-thread", () => ({ useUnreadNotesAboutMe: () => ({ data: [] }) }));
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
    display_name: "Liam", title_band: null, clients_enabled: true, tier: ["company","partner"].includes(state.type) ? "business" : "individual", has_roster: ["company","partner"].includes(state.type), shows_admin_role: ["company","partner"].includes(state.type), has_firm_view: state.type === "company", onboarding: null } as Profile;
}
function makeProfiles(): Profile[] { return state.count === 1 ? [profile()] : [profile(), { ...profile(), id: "p2", org_id: "o2", org_name: "Bright Path" }]; }
function context(): NavCtx {
  return { type: profile().org_type, role: state.role, canReview: false, canManageMembers: ["admin", "lead"].includes(state.role),
    canSeeFirmView: state.type === "company" && ["admin", "lead"].includes(state.role), hasCoachLink: false, affiliated: false, clientsEnabled: true, workItemCount: 0 };
}
function mount(children: ReactNode) { return render(<QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>); }
function openMenu() { fireEvent.click(screen.getByRole("button", { name: /Change workspace/ })); return screen.getByRole("menu"); }
beforeEach(() => { vi.clearAllMocks(); state.type = "company"; state.role = "admin"; state.count = 2; });
afterEach(cleanup);

describe("MN-3a workspace menu", () => {
  it.each([
    ["company", "admin", "FIRM · ADMIN", ["firm-view", "members", "settings", "trust", "why", "feedback", "sign-out"]],
    ["company", "em", "FIRM · MEMBER", ["settings", "trust", "why", "feedback", "sign-out"]],
    ["partner", "admin", "PARTNER · ADMIN", ["workshop-keys", "adding-people", "members", "settings", "trust", "why", "feedback", "sign-out"]],
    ["personal", "admin", "INDIVIDUAL", ["settings", "trust", "why", "feedback", "sign-out"]],
    ["edu", "admin", "SCHOOL", ["settings", "trust", "why", "feedback", "sign-out"]],
    ["company", "coach", "FIRM · MEMBER", ["guest-settings", "trust", "why", "feedback", "sign-out"]],
  ])("%s %s: name, type and ordered menu", (type, role, label, expected) => {
    state.type = type as string; state.role = role as string;
    mount(<WorkspaceMenu />);
    const trigger = screen.getByRole("button", { name: /Change workspace/ });
    expect(trigger.textContent).toContain("Northline"); expect(trigger.textContent).toContain(label);
    const menu = openMenu();
    expect(Array.from(menu.querySelectorAll("[data-nav-item]")).map((row) => row.getAttribute("data-nav-item"))).toEqual(expected);
    expect(within(menu).getByText("Liam")).toBeTruthy();
    expect(state.events).toHaveBeenCalledExactlyOnceWith("nav.opened", "o1", { item: "workspace", surface: "sidebar" });
    const resolved = navFor(context(), { vocab: vocabFor(profile()), institutionName: null }).filter((g) => g.placement === "workspace_menu").flatMap((g) => g.items);
    expect(resolved.map((item) => item.id)).toEqual(expected);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Settings" }));
    expect(state.settings).toHaveBeenCalledOnce();
    expect(state.events).toHaveBeenLastCalledWith("nav.opened", "o1", { item: role === "coach" ? "guest-settings" : "settings", surface: "workspace_menu" });
  });
  it("one workspace still shows a menu, without a workspace list", () => {
    state.count = 1; mount(<WorkspaceMenu />);
    expect(screen.getByRole("button", { name: /Northline.*FIRM/ })).toBeTruthy();
    const menu = openMenu();
    expect(within(menu).queryByText("Choose workspace")).toBeNull();
    expect(within(menu).getByText("Settings")).toBeTruthy();
  });
  it.each(["personal", "edu"])("%s keeps Your coaches as a bottom sidebar row, never in the menu", (type) => {
    state.type = type;
    mount(<><WorkspaceMenu /><SidebarNav /></>);
    const coaches = screen.getByRole("link", { name: "Your coaches" });
    expect(coaches.closest('[data-nav-placement="bottom"]')).toBeTruthy();
    expect(screen.getByText("Who you share with")).toBeTruthy();
    expect(within(openMenu()).queryByText("Your coaches")).toBeNull();
  });
  it.each(["admin", "lead"])("company %s sees Firm view and member role does not", (role) => {
    state.role = role; mount(<WorkspaceMenu />);
    expect(within(openMenu()).getByText("Firm view")).toBeTruthy();
  });
  it("sidebar links emit the manifest ID and drawer uses drawer surface", () => {
    const view = mount(<SidebarNav />);
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    expect(state.events).toHaveBeenCalledWith("nav.opened", "o1", { item: "home", surface: "sidebar" });
    view.unmount(); mount(<><WorkspaceMenu surface="drawer" /><SidebarNav surface="drawer" /></>);
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    expect(state.events).toHaveBeenLastCalledWith("nav.opened", "o1", { item: "home", surface: "drawer" });
    const menu = openMenu();
    expect(state.events).toHaveBeenLastCalledWith("nav.opened", "o1", { item: "workspace", surface: "drawer" });
    fireEvent.click(within(menu).getByText("Settings"));
    expect(state.events).toHaveBeenLastCalledWith("nav.opened", "o1", { item: "settings", surface: "drawer" });
  });
  it.each(["firm-view", "members", "trust", "why", "feedback", "sign-out"])("menu action %s emits its exact dimensions", (id) => {
    mount(<WorkspaceMenu />); const menu = openMenu();
    const row = menu.querySelector(`[data-nav-item="${id}"]`);
    if (!row) throw new Error("Missing menu row");
    fireEvent.click(row);
    expect(state.events).toHaveBeenLastCalledWith("nav.opened", "o1", { item: id, surface: "workspace_menu" });
    if (id === "sign-out") expect(state.reset).toHaveBeenCalledOnce();
  });
});