// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: { id: "c1", role: "coach", org_type: "company", display_name: "Coach" } as {
    id: string;
    role: string;
    org_type: string;
    display_name: string;
  } | null,
  navigate: vi.fn(),
}));

vi.mock("@/hooks/use-profile", () => ({
  isBusinessOrg: (p: { org_type: string } | null | undefined) => p?.org_type === "company",
  useProfile: () => ({ data: mocks.profile, profiles: mocks.profile ? [mocks.profile] : [] }),
}));
vi.mock("@/hooks/use-my-deliverables", () => ({ useMyDeliverables: () => ({ data: [] }) }));
vi.mock("@/hooks/use-shipped-work", () => ({ useShippedWork: () => ({ data: [] }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => mocks.navigate,
  useRouter: () => ({ navigate: mocks.navigate, subscribe: () => () => {} }),
  useRouterState: () => "/overview",
}));

import { OverviewPage } from "@/pages/OverviewPage";
import { fetchMyEngagements } from "@/hooks/use-engagements";

afterEach(() => {
  cleanup();
  mocks.navigate.mockClear();
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <OverviewPage />
    </QueryClientProvider>,
  );
}

describe("overview with a coach profile", () => {
  it("renders without throwing and sends the coach to their own home", () => {
    expect(() => renderPage()).not.toThrow();
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/coaching", replace: true });
    expect(screen.queryByText("Prepare a 1:1")).toBeNull();
  });

  it("still renders the owner view for a member profile", () => {
    mocks.profile = { id: "p1", role: "member", org_type: "company", display_name: "M" };
    expect(() => renderPage()).not.toThrow();
    expect(mocks.navigate).not.toHaveBeenCalled();
    mocks.profile = { id: "c1", role: "coach", org_type: "company", display_name: "Coach" };
  });
});

describe("engagement list sorting", () => {
  it("does not throw when an engagement carries no code", async () => {
    vi.resetModules();
    const rows = [
      { engagements: { id: "b", code: null, title: "B", client_label: null, clients: null } },
      { engagements: { id: "a", code: "E-1", title: "A", client_label: null, clients: null } },
    ];
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: { from: () => ({ select: () => ({ eq: () => ({ data: rows, error: null }) }) }) },
    }));
    const { fetchMyEngagements: fetchFresh } = await import("@/hooks/use-engagements");
    await expect(fetchFresh("p1")).resolves.toHaveLength(2);
    expect(typeof fetchMyEngagements).toBe("function");
  });
});
