// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrgSwitcher } from "@/components/layout/OrgSwitcher";
import type { Profile } from "@/hooks/use-profile";

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...args: unknown[]) => logEvent(...args) }));

function profile(over: Partial<Profile>): Profile {
  return {
    id: "p1",
    user_id: "u1",
    org_id: "o1",
    role: "em",
    display_name: "Dana",
    title_band: null,
    org_name: "Northline",
    org_type: "company",
    onboarding: null,
    ...over,
  } as Profile;
}

function renderSwitcher(profiles: Profile[], active: Profile | null) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <OrgSwitcher profiles={profiles} active={active} />
    </QueryClientProvider>,
  );
}

describe("OrgSwitcher", () => {
  it("stays hidden for a single profile", () => {
    const one = profile({});
    const { container } = renderSwitcher([one], one);
    expect(container.textContent).toBe("");
  });

  it("renders role first and emits one switch record", () => {
    logEvent.mockClear();
    const mine = profile({});
    const coaching = profile({ id: "p2", org_id: "o2", role: "coach", org_name: "Bright Path" });
    renderSwitcher([mine, coaching], mine);

    expect(screen.getAllByText("Engagement Mgr").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Coach").length).toBe(1);

    fireEvent.click(screen.getByText("Coach"));
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("profile.switched", "o2", {
      from_role: "em",
      to_role: "coach",
      same_org: false,
    });
  });
});
