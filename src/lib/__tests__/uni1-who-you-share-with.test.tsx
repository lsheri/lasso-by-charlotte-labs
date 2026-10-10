// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { MembersPage } from "@/pages/MembersPage";
import { AffiliationPage } from "@/pages/AffiliationPage";
import { listMyPartnerShares, listSharedEngagements } from "@/lib/partner-share";

const state = vi.hoisted(() => ({ orgType: "personal", institution: true, noteRead: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => state.noteRead }));
vi.mock("@/lib/affiliation.functions", () => ({ noteDisclosureReadFn: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a> }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "person", org_id: "org", role: "admin", org_type: state.orgType } }),
  isBusinessOrg: (profile: { org_type: string }) => ["company", "partner"].includes(profile.org_type),
  ROLE_LABELS: { coach: "Coach" },
}));
vi.mock("@/hooks/use-affiliation", () => ({ useAffiliation: () => ({ data: { institution: state.institution ? { id: "institution", name: "Ceiba Uni", slug: "ceiba-uni" } : null } }) }));
vi.mock("@/hooks/use-engagements", () => ({ useEngagements: () => ({ data: [{ id: "board", title: "Shared work" }] }) }));
vi.mock("@/lib/partner-share", () => ({ listMyPartnerShares: vi.fn(async () => [{ linkId: "link", institutionId: "institution" }]), listSharedEngagements: vi.fn(async () => ["board"]), unshareEngagement: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }) } }));
vi.mock("@/hooks/use-members", () => ({
  useMembers: () => ({ data: { viewer_role: "admin", members: [{ id: "coach", display_name: "Alex Example", role: "coach", created_at: "2026-01-01", deactivated_at: null }], invites: [], entitlement: null }, isLoading: false, error: null }),
  useMemberAction: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/invites/InviteDialog", () => ({ InviteDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</> }));
vi.mock("@/components/settings/YourDataCard", () => ({ OrgDataCard: () => <div>Your data</div> }));
vi.mock("@/components/coaching/ShareWorkDialog", () => ({ ShareWorkDialog: () => null }));

function open(Page: typeof MembersPage) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
  return client;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); state.orgType = "personal"; state.institution = true; });
beforeEach(() => {
  state.noteRead.mockResolvedValue({ ok: true });
  vi.mocked(listMyPartnerShares).mockResolvedValue([{ linkId: "link", institutionId: "institution", institutionName: "Ceiba Uni", bound: false }]);
  vi.mocked(listSharedEngagements).mockResolvedValue(["board"]);
});

describe("UNI-1 individual sharing page", () => {
  it.each(["personal", "edu"])("merges %s sharing above people without firm roles", async (orgType) => {
    state.orgType = orgType;
    const client = open(MembersPage);
    expect(screen.getByRole("heading", { name: "Who you share with" })).toBeTruthy();
    await screen.findByText("Ceiba Uni can open these boards.");
    const sharing = screen.getByTestId("affiliation-sharing");
    const people = screen.getByText("People with access");
    expect(sharing.compareDocumentPosition(people) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Role", { exact: true })).toBeNull();
    expect(screen.queryByText("Coach", { exact: true })).toBeNull();
    expect(screen.queryByText("WHAT A ROLE CHANGES")).toBeNull();
    expect(screen.getByRole("button", { name: "Stop sharing" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share work with Alex" })).toBeTruthy();
    await waitFor(() => expect(state.noteRead).toHaveBeenCalledTimes(1));
    client.clear();
  });
  it.each(["company", "partner"])("preserves the %s members console", (orgType) => {
    state.orgType = orgType;
    const client = open(MembersPage);
    expect(screen.getByRole("heading", { name: /Members/ })).toBeTruthy();
    expect(screen.getByText("Role", { exact: true })).toBeTruthy();
    expect(screen.getByText("WHAT A ROLE CHANGES")).toBeTruthy();
    expect(screen.queryByTestId("affiliation-sharing")).toBeNull();
    expect(state.noteRead).not.toHaveBeenCalled();
    client.clear();
  });
  it("keeps the personal affiliation bookmark explanatory", () => {
    const client = open(AffiliationPage);
    expect(screen.getByText("This has moved. Everything you have shared, and who can see it, is on one page now.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Who you share with" }).getAttribute("href")).toBe("/members");
    expect(screen.queryByTestId("affiliation-counts")).toBeNull();
    expect(state.noteRead).not.toHaveBeenCalled();
    client.clear();
  });
  it("preserves company affiliation content", async () => {
    state.orgType = "company";
    const client = open(AffiliationPage);
    await screen.findByText("Ceiba Uni can open these boards.");
    expect(screen.getByTestId("affiliation-counts")).toBeTruthy();
    expect(screen.getByText("What stays put")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Who you share with" })).toBeNull();
    client.clear();
  });
  it("defines reads once in the exported hook and both pages consume it", () => {
    const affiliation = readFileSync("src/pages/AffiliationPage.tsx", "utf8");
    const members = readFileSync("src/pages/MembersPage.tsx", "utf8");
    expect(affiliation.match(/export function useSharedBoards\(/g)).toHaveLength(1);
    expect(affiliation.match(/listMyPartnerShares\(profile.id\)/g)).toHaveLength(1);
    expect(affiliation).toContain("useSharedBoards(business)");
    expect(members).toContain("useSharedBoards(!business)");
    expect(members).not.toMatch(/listMyPartnerShares|listSharedEngagements|useAffiliation|useEngagements/);
    const nav = readFileSync("src/components/layout/SidebarNav.tsx", "utf8");
    expect(nav).toContain('group.id === "account" && institution && isBusinessOrg(profile)');
  });
});