// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navFor, TAB_ITEMS, type NavCtx } from "@/components/layout/nav-config";
import { vocabFor } from "@/lib/edu-vocab";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";

const state = vi.hoisted(() => ({
  type: "company", role: "em", canReview: false,
  events: vi.fn(), reset: vi.fn(), signOut: vi.fn(async () => ({})), navigate: vi.fn(), settings: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search, hash, params, activeProps, ...props }: Record<string, any>) =>
    <a href={`${to.replace("$id", params?.id ?? "")}${search ? `?${new URLSearchParams(search)}` : ""}${hash ? `#${hash}` : ""}`} {...props}>{children}</a>,
  useNavigate: () => state.navigate,
  useRouterState: () => "/home",
}));
vi.mock("@/hooks/use-profile", () => ({
  isBusinessOrg: (profile: { org_type?: string } | null) => profile?.org_type === "company" || profile?.org_type === "partner",
  useProfile: () => ({
  data: { id: "p1", org_id: "o1", org_type: state.type, role: state.role, display_name: "Liam" }, profiles: [],
}) }));
vi.mock("@/hooks/use-affiliation", () => ({ useAffiliation: () => ({ data: null }) }));
vi.mock("@/hooks/use-coaching-links", () => ({ useHasLiveCoachLink: () => false }));
vi.mock("@/hooks/use-coaching-reach", () => ({ useCoachingReach: () => ({ canReach: state.canReview }) }));
vi.mock("@/hooks/use-engagements", () => ({ useEngagements: () => ({ data: [{ id: "b1", code: "ABC-01", title: "Pricing review" }] }) }));
vi.mock("@/components/layout/OrgSwitcher", () => ({ OrgSwitcher: () => null }));
vi.mock("@/components/coaching/CoachAskSheet", () => ({ CoachAskSheet: ({ open }: { open: boolean }) => open ? <div>Coach messages</div> : null }));
vi.mock("@/components/feedback/FeedbackWidget", () => ({ FeedbackDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</> }));
vi.mock("@/lib/telemetry", () => ({ logEvent: state.events }));
vi.mock("@/lib/posthog-client", () => ({ resetPostHog: state.reset }));
vi.mock("@/lib/settings-dialog-context", () => ({ useSettingsDialogOptional: () => ({ openSettings: state.settings }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: state.signOut } } }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { useNavCtx } from "@/components/layout/use-nav-ctx";

function ContextProbe() {
  const { ctx } = useNavCtx();
  return <output data-testid="ctx">{JSON.stringify(ctx)}</output>;
}
beforeEach(() => { vi.clearAllMocks(); state.type = "company"; state.role = "em"; state.canReview = false; });
afterEach(cleanup);

describe("MN-2b phone navigation", () => {
  for (const [type, role] of [["company", "em"], ["company", "admin"], ["partner", "admin"], ["personal", "admin"], ["edu", "admin"], ["company", "coach"]]) {
    it(`${type} ${role}: ordered More items equal the manifest`, () => {
      state.type = type ?? "company"; state.role = role ?? "em";
      render(<><ContextProbe /><MobileTabBar /></>);
      const ctx = JSON.parse(screen.getByTestId("ctx").textContent ?? "{}") as NavCtx;
      const expected = navFor(ctx, { vocab: vocabFor({ org_type: ctx.type }), institutionName: null })
        .filter(g => g.id !== "engagements").flatMap(g => g.items.filter(i => i.id !== "all-work"));
      fireEvent.click(screen.getByRole("button", { name: "More" }));
      const items = Array.from(screen.getByTestId("sheet").querySelectorAll("[data-nav-item]"));
      expect(items.map(i => i.getAttribute("data-nav-item"))).toEqual(expected.map(i => i.id));
      expect(items.map(i => (i.textContent ?? "").replace(/Coming soon$/, ""))).toEqual(expected.map(i => i.label));
      expect(state.events).toHaveBeenCalledWith("nav.opened", "o1", { item: "more", surface: "tab" });
      expect(items.filter(i => i.getAttribute("aria-disabled") === "true").length).toBe(expected.filter(i => i.disabled).length);
    });
  }
  it("workers have exactly Work, Workboards, More and emit tab events", () => {
    render(<MobileTabBar />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(Array.from(nav.querySelectorAll("a, button")).map(i => i.textContent)).toEqual(["Work", "Workboards", "More"]);
    fireEvent.click(within(nav).getByRole("link", { name: "Work" }));
    expect(state.events).toHaveBeenCalledWith("nav.opened", "o1", { item: "all-work", surface: "tab" });
    fireEvent.click(within(nav).getByRole("button", { name: "Workboards" }));
    expect(state.events).toHaveBeenCalledWith("nav.opened", "o1", { item: "workboards", surface: "tab" });
  });
  it("board rows show titles only and emit a content-free board event", () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "Workboards" }));
    expect(screen.queryByText(/ABC-01|Folder/)).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Pricing review" }));
    expect(state.events).toHaveBeenCalledWith("nav.opened", "o1", { item: "board", surface: "workboards_sheet" });
    expect(screen.queryByTestId("sheet")).toBeNull();
  });
  it("More opens settings through its handler and emits the item event", () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(state.settings).toHaveBeenCalledOnce();
    expect(state.events).toHaveBeenCalledWith("nav.opened", "o1", { item: "settings", surface: "more" });
  });
  it("a More link emits its manifest ID and disabled rows emit nothing", () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    state.events.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Find it/ }));
    expect(state.events).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    expect(state.events).toHaveBeenCalledWith("nav.opened", "o1", { item: "home", surface: "more" });
  });
  it("More sign-out resets PostHog then signs out and returns to auth", async () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await vi.waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ to: "/auth", replace: true }));
    expect(state.reset).toHaveBeenCalledOnce(); expect(state.signOut).toHaveBeenCalledOnce();
    expect(state.reset.mock.invocationCallOrder[0]).toBeLessThan(state.signOut.mock.invocationCallOrder[0] ?? Infinity);
  });
  it.each([false, true])("guest tabs and coach messages remain intact, canReview=%s", (canReview) => {
    state.role = "coach"; state.canReview = canReview;
    render(<MobileTabBar />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(Array.from(nav.querySelectorAll("a, button")).map(i => i.textContent)).toEqual(canReview ? ["Coaching", "1:1 prep", "Ask", "More"] : ["1:1 prep", "More"]);
    if (canReview) { fireEvent.click(screen.getByRole("button", { name: "Ask" })); expect(screen.getByText("Coach messages")).toBeTruthy(); }
  });
  it("labels come from TAB_ITEMS and nav.opened has only item and surface dims", () => {
    expect(TAB_ITEMS.work.label).toBe("Work");
    expect(EVENT_DIM_KEYS["nav.opened"]).toEqual(["item", "surface"]);
    const source = readFileSync("src/components/layout/MobileTabBar.tsx", "utf8");
    for (const label of ["Where work lives", "Past Ask Lasso chats", "1:1 prep", "All AI Conversations", "Find it", "Decision log", "Firm view", "Settings"]) {
      expect(source).not.toContain(`"${label}"`);
    }
  });
});