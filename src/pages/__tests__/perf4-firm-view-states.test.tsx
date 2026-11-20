// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** QA F3: when the Firm view counts fail, the skeleton stops and the error line shows alone. */
const mocks = vi.hoisted(() => ({
  dashboard: { data: undefined as unknown, isLoading: true, error: null as unknown },
}));

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "o1", role: "admin", org_type: "company", has_firm_view: true } }),
}));
vi.mock("@/lib/workspace-capabilities", () => ({ profileHasFirmView: () => true }));
vi.mock("@/hooks/use-firm-dashboard", () => ({ useFirmDashboard: () => mocks.dashboard }));
vi.mock("@/components/firm/ChecksLibrary", () => ({ ChecksLibrary: () => <div data-testid="stub-ChecksLibrary" /> }));
vi.mock("@/components/firm/FirmArchive", () => ({ FirmArchive: () => <div data-testid="stub-FirmArchive" /> }));
vi.mock("@/components/firm/FirmLiveBoards", () => ({ FirmLiveBoards: () => <div data-testid="stub-FirmLiveBoards" /> }));
vi.mock("@/components/firm/FirmProposalsCard", () => ({ FirmProposalsCard: () => <div data-testid="stub-FirmProposalsCard" /> }));
vi.mock("@/components/firm/FirmMetricGrid", () => ({ FirmMetricGrid: () => <div data-testid="stub-FirmMetricGrid" /> }));
vi.mock("@/components/firm/FirmProduced", () => ({ FirmProduced: () => <div data-testid="stub-FirmProduced" /> }));
vi.mock("@/components/firm/PrivacyPanel", () => ({ PrivacyPanel: () => <div data-testid="stub-PrivacyPanel" /> }));
vi.mock("@/components/firm/TrustSummary", () => ({ TrustSummary: () => <div data-testid="stub-TrustSummary" /> }));
vi.mock("@/components/firm/WhatLeavesTheFirm", () => ({ WhatLeavesTheFirm: () => <div data-testid="stub-WhatLeavesTheFirm" /> }));
vi.mock("@/components/firm-brain/CommonQuestionsCard", () => ({ CommonQuestionsCard: () => <div data-testid="stub-CommonQuestionsCard" /> }));
vi.mock("@/components/firm-brain/FirmBrainMap", () => ({ FirmBrainMap: () => <div data-testid="stub-FirmBrainMap" /> }));

const { FirmDashboardPage } = await import("@/pages/FirmDashboardPage");

function mount() {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}><FirmDashboardPage /></QueryClientProvider>);
}

afterEach(cleanup);

describe("Firm view loading and failure", () => {
  it("shows one status region while the counts load", () => {
    mocks.dashboard = { data: undefined, isLoading: true, error: null };
    mount();
    const busy = document.querySelectorAll("[aria-busy='true']");
    expect(busy).toHaveLength(1);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("Counting");
    expect(screen.getByTestId("firm-view-rows-skeleton").getAttribute("aria-hidden")).toBe("true");
  });

  it("stops the skeleton and shows the error line alone when the counts fail", () => {
    mocks.dashboard = { data: undefined, isLoading: false, error: new Error("failed") };
    mount();
    expect(screen.getByText("That could not be loaded. Try again.")).toBeTruthy();
    expect(document.querySelectorAll("[aria-busy='true']")).toHaveLength(0);
    expect(screen.queryByTestId("skeleton-frame")).toBeNull();
    expect(screen.queryByTestId("firm-view-rows-skeleton")).toBeNull();
  });

  it("keeps showing counts it already has when a later read fails", () => {
    mocks.dashboard = {
      data: { adoption: { active_members: 3 }, window_days: 30, assurance: { total_runs: 0, firm_check_runs: 0 }, coaching: { engagements_shared: 0 } },
      isLoading: false,
      error: new Error("refresh failed"),
    };
    mount();
    expect(screen.getByText("That could not be loaded. Try again.")).toBeTruthy();
    expect(screen.getByTestId("stub-FirmLiveBoards")).toBeTruthy();
    expect(document.querySelectorAll("[aria-busy='true']")).toHaveLength(0);
  });
});
