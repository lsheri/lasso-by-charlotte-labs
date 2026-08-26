// @vitest-environment jsdom
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
}));

vi.mock("@/hooks/use-profile", () => ({
  isBusinessOrg: (p: { org_type: string } | null | undefined) => p?.org_type === "company",
  useProfile: () => ({ data: mocks.profile, profiles: mocks.profile ? [mocks.profile] : [] }),
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
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

function profile(role: string, orgType: "company" | "personal") {
  return { id: "p1", role, org_type: orgType, display_name: "Test" };
}

function setup(role: string, orgType: "company" | "personal") {
  mocks.profile = profile(role, orgType);
  mocks.engagements = [];
  mocks.decisions = [];
  return render(<SidebarNav />);
}

afterEach(() => {
  cleanup();
  mocks.profile = null;
  mocks.engagements = [];
  mocks.decisions = [];
});

describe("Pass 123: the sidebar grows an Admin section", () => {
  it("config places Admin after Your work with Firm view + Members", () => {
    expect(navGroups.map((g) => g.label)).toEqual([
      "Connectors",
      "Work",
      "Engagements",
      "Your work",
      "Admin",
    ]);

    const yourWork = navGroups.find((g) => g.label === "Your work")!;
    expect(yourWork.items.map((i) => i.to)).toEqual([
      "/overview",
      "/reflect",
      "/ai-record",
      "/one-on-one",
      "/decisions",
      "/settings",
    ]);
    expect(yourWork.items.map((i) => i.to)).not.toContain("/firm");
    expect(yourWork.items.map((i) => i.to)).not.toContain("/members");

    const admin = navGroups.find((g) => g.label === "Admin")!;
    expect(admin.items.map((i) => ({ to: i.to, label: i.label }))).toEqual([
      { to: "/firm", label: "Firm view" },
      { to: "/members", label: "Members" },
    ]);
  });

  it("admin on a business org sees Admin with Firm view + Members", () => {
    setup("admin", "company");

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Firm view")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();

    expect(screen.getByText("Your work")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();

    // Firm view and Members should not also appear under Your work.
    const yourWorkSection = screen.getByText("Your work").parentElement!;
    expect(yourWorkSection.textContent).not.toContain("Firm view");
    expect(yourWorkSection.textContent).not.toContain("Members");
  });

  it("plain member on a business org sees no Admin header at all", () => {
    setup("member", "company");

    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.queryByText("Firm view")).toBeNull();
    expect(screen.queryByText("Members")).toBeNull();
    expect(screen.queryByText("Your coaches")).toBeNull();

    expect(screen.getByText("Your work")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("admin on a solo org sees Admin with 'Your coaches' only", () => {
    setup("admin", "personal");

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Your coaches")).toBeInTheDocument();
    expect(screen.queryByText("Firm view")).toBeNull();
    expect(screen.queryByText("Members")).toBeNull();

    expect(screen.getByText("Your work")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("coach nav is unchanged and shows Coaching + Your account", () => {
    setup("coach", "company");

    expect(screen.queryByText("Your work")).toBeNull();
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.queryByText("Overview")).toBeNull();

    expect(screen.getByText("Coaching")).toBeInTheDocument();
    expect(screen.getByText("People you coach")).toBeInTheDocument();
    expect(screen.getByText("Your account")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
