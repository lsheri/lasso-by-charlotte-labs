// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarNav } from "@/components/layout/SidebarNav";
import { navGroups } from "@/components/layout/nav-config";

const mocks = vi.hoisted(() => ({
  profile: null as {
    id: string;
    role: string;
    org_type: "company" | "personal";
    display_name: string;
  } | null,
  engagements: [] as unknown[],
  decisions: [] as unknown[],
  canReach: false,
}));

vi.mock("@/hooks/use-profile", () => ({
  isBusinessOrg: (p: { org_type: string } | null | undefined) => p?.org_type === "company",
  useProfile: () => ({ data: mocks.profile, profiles: mocks.profile ? [mocks.profile] : [] }),
}));

vi.mock("@/hooks/use-coaching-reach", () => ({
  useCoachingReach: () => ({ engagementIds: [], profileIds: [], canReach: mocks.canReach }),
}));

vi.mock("@/hooks/use-engagements", () => ({
  useEngagements: () => ({ data: mocks.engagements }),
}));

vi.mock("@/hooks/use-decisions", () => ({
  useDecisions: () => ({ data: mocks.decisions }),
}));

vi.mock("@/components/engagements/NewEngagementDialog", () => ({
  NewEngagementDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, activeProps: _activeProps, children, ...rest }: { to: string; activeProps?: unknown; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useMatchRoute: () => () => false,
  useSearch: () => ({}),
}));

function profile(role: string, orgType: "company" | "personal") {
  return { id: "p1", role, org_type: orgType, display_name: "Test" };
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function setup(role: string, orgType: "company" | "personal") {
  mocks.profile = profile(role, orgType);
  mocks.engagements = [];
  mocks.decisions = [];
  return render(
    <QueryClientProvider client={queryClient}>
      <SidebarNav />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  mocks.profile = null;
  mocks.engagements = [];
  mocks.decisions = [];
});

describe("Pass 123: the sidebar follows the weekly loop", () => {
  it("config places Look back before Run the firm", () => {
    // Nav is now ordered by the weekly loop rather than by object type.
    expect(navGroups.map((g) => g.label)).toEqual([
      "What landed",
      "Where it goes",
      "Look back",
      "Your coach",
      "Run the firm",
      "Your account",
    ]);

    const lookback = navGroups.find((g) => g.label === "Look back")!;
    expect(lookback.items.map((i) => i.to)).toEqual(["/ai-record", "/find-it", "/decisions"]);
    expect(lookback.items.find((i) => i.label === "Past Ask Lasso chats")?.search).toEqual({ view: "asked" });
    expect(lookback.items.filter((i) => i.disabled).map((i) => i.label)).toEqual(["Find it", "Decision log"]);
    expect(lookback.items.map((i) => i.to)).not.toContain("/firm");
    expect(lookback.items.map((i) => i.to)).not.toContain("/members");

    const coachGroup = navGroups.find((g) => g.label === "Your coach")!;
    expect(coachGroup.items.map((i) => i.to)).toEqual(["/one-on-one", "/coach-notes"]);

    // Overview and Reflect are retired; Past work sits with the shelves.
    const everyTo = navGroups.flatMap((g) => g.items.map((i) => i.to));
    expect(everyTo).not.toContain("/overview");
    expect(everyTo).not.toContain("/reflect");
    expect(navGroups.find((g) => g.id === "engagements")!.items.map((i) => i.to)).toEqual([
      "/archive",
    ]);

    const runTheFirm = navGroups.find((g) => g.label === "Run the firm")!;
    expect(runTheFirm.items.map((i) => ({ to: i.to, label: i.label }))).toEqual([
      { to: "/firm", label: "Firm view" },
      { to: "/members", label: "Members" },
    ]);
  });

  it("admin on a business org sees Run the firm with Firm view + Members", () => {
    setup("admin", "company");

    expect(screen.queryByText("Run the firm")).not.toBeNull();
    expect(screen.queryByText("Firm view")).not.toBeNull();
    expect(screen.queryByText("Members")).not.toBeNull();

    expect(screen.queryByText("Look back")).not.toBeNull();
    expect(screen.queryByText("Settings")).not.toBeNull();

    // Firm view and Members should not also appear under Look back.
    const lookbackSection = screen.getByText("Look back").parentElement!;
    expect(lookbackSection.textContent).not.toContain("Firm view");
    expect(lookbackSection.textContent).not.toContain("Members");
  });

  it("plain member on a business org sees no Run the firm header at all", () => {
    setup("member", "company");

    expect(screen.queryByText("Run the firm")).toBeNull();
    expect(screen.queryByText("Firm view")).toBeNull();
    expect(screen.queryByText("Members")).toBeNull();
    expect(screen.queryByText("Your coaches")).toBeNull();

    expect(screen.queryByText("Look back")).not.toBeNull();
    expect(screen.queryByText("Settings")).not.toBeNull();
  });

  it("admin on a solo org sees Run the firm with 'Your coaches' only", () => {
    setup("admin", "personal");

    expect(screen.queryByText("Run the firm")).not.toBeNull();
    expect(screen.queryByText("Your coaches")).not.toBeNull();
    expect(screen.queryByText("Firm view")).toBeNull();
    expect(screen.queryByText("Members")).toBeNull();

    expect(screen.queryByText("Look back")).not.toBeNull();
    expect(screen.queryByText("Settings")).not.toBeNull();
  });

  it("guest nav shows Coaching only when a board was shared for review", () => {
    // S4 — the coaching destination follows the grant, not the workspace role.
    mocks.canReach = true;
    setup("coach", "company");

    expect(screen.queryByText("What you learned")).toBeNull();
    expect(screen.queryByText("Run the firm")).toBeNull();
    expect(screen.queryByText("Overview")).toBeNull();

    expect(screen.queryByText("Coaching")).not.toBeNull();
    expect(screen.queryByText("People you coach")).not.toBeNull();
    expect(screen.queryByText("Your account")).not.toBeNull();
    expect(screen.queryByText("Settings")).not.toBeNull();
    cleanup();

    mocks.canReach = false;
    setup("coach", "company");
    expect(screen.queryByText("People you coach")).toBeNull();
    expect(screen.queryByText("Settings")).not.toBeNull();
  });

  it("gives a worker the coaching destination once they hold Review somewhere", () => {
    mocks.canReach = true;
    setup("member", "company");
    expect(screen.queryByText("People you coach")).not.toBeNull();
    cleanup();

    mocks.canReach = false;
    setup("member", "company");
    expect(screen.queryByText("People you coach")).toBeNull();
  });
});

