// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Profile } from "@/hooks/use-profile";

const state = vi.hoisted(() => ({ profiles: [] as unknown[] }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => () => {},
  useRouterState: () => "/home",
}));
vi.mock("@/hooks/use-profile", async (orig) => ({
  ...(await orig<object>()),
  useProfile: () => ({ data: state.profiles[0] ?? null, profiles: state.profiles }),
}));
vi.mock("@/hooks/use-engagements", () => ({ useEngagements: () => ({ data: [] }) }));
vi.mock("@/hooks/use-coaching-reach", () => ({ useCoachingReach: () => ({ canReach: false }) }));
vi.mock("@/components/reflect/ask-lasso-context", () => ({ useAskLassoHandler: () => null }));
vi.mock("@/components/coaching/CoachAskSheet", () => ({ CoachAskSheet: () => null }));
vi.mock("@/components/feedback/FeedbackWidget", () => ({ FeedbackDialog: () => null }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));

import { MobileTabBar } from "@/components/layout/MobileTabBar";

function p(id: string, org: string): Profile {
  return {
    id, user_id: "u1", org_id: `o-${id}`, role: "em", display_name: "Liam",
    title_band: null, org_name: org, org_type: "company", clients_enabled: true, onboarding: null,
  };
}

function openYouSheet() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MobileTabBar />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /^you$/i }));
}

afterEach(() => cleanup());

describe("Unit X: workspace switcher on the phone", () => {
  it("renders in the You sheet with two or more workspaces", async () => {
    state.profiles = [p("a", "Northline"), p("b", "Bright Path")];
    openYouSheet();
    expect(await screen.findByTestId("mobile-workspace-switcher")).not.toBeNull();
    expect(screen.getByRole("button", { name: /change workspace/i })).not.toBeNull();
  });

  it("does not render with one workspace", async () => {
    state.profiles = [p("a", "Northline")];
    openYouSheet();
    await screen.findByText("Liam");
    expect(screen.queryByTestId("mobile-workspace-switcher")).toBeNull();
    expect(screen.queryByRole("button", { name: /change workspace/i })).toBeNull();
  });
});
