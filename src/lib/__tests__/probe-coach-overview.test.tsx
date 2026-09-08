// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const coach = {
  id: "c1",
  user_id: "u1",
  org_id: "o1",
  role: "coach",
  display_name: "Coach",
  org_type: "company",
  onboarding: null,
};

vi.mock("@/hooks/use-profile", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useProfile: () => ({ data: coach, profiles: [coach] }),
    useProfiles: () => ({ data: [coach] }),
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => () => {},
  useRouter: () => ({ navigate: () => {}, subscribe: () => () => {} }),
  useRouterState: () => "/overview",
}));

import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { OverviewPage } from "@/pages/OverviewPage";

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

describe("probe", () => {
  it("overview page", () => {
    expect(() => wrap(<OverviewPage />)).not.toThrow();
  });
  it("sidebar", () => {
    expect(() =>
      wrap(
        <AppSidebar
          userName="Coach"
          userRole="coach"
          profiles={[coach as never]}
          activeProfile={coach as never}
          onSignOut={() => {}}
        />,
      ),
    ).not.toThrow();
  });
  it("tab bar", () => {
    expect(() => wrap(<MobileTabBar />)).not.toThrow();
  });
});
