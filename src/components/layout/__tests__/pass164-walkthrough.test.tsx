// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Profile } from "@/hooks/use-profile";

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...args: unknown[]) => logEvent(...args) }));

const profileRef: { current: Profile } = {
  current: {
    id: "p1",
    user_id: "u1",
    org_id: "o1",
    role: "em",
    display_name: "Dana",
    title_band: null,
    org_name: "Northline",
    org_type: "personal",
    onboarding: null,
    created_at: new Date().toISOString(),
  } as Profile,
};
vi.mock("@/hooks/use-profile", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/use-profile")>(
    "@/hooks/use-profile",
  );
  return { ...actual, useProfile: () => ({ data: profileRef.current, profiles: [] }) };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

let observed: (() => void)[] = [];
class TestObserver {
  cb: (entries: { isIntersecting: boolean }[]) => void;
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    this.cb = cb;
  }
  observe() {
    observed.push(() => this.cb([{ isIntersecting: true }]));
  }
  disconnect() {}
}

import { HowLassoWorksPage } from "@/pages/HowLassoWorksPage";
import { walkthroughFor } from "@/lib/walkthrough";

describe("pass 164 walkthrough page", () => {
  beforeEach(() => {
    logEvent.mockClear();
    observed = [];
    vi.stubGlobal("IntersectionObserver", TestObserver as unknown as typeof IntersectionObserver);
  });

  it("records one open, whatever the onboarding state says", () => {
    render(<HowLassoWorksPage />);
    expect(screen.getAllByText("How Lasso works").length).toBeGreaterThan(0);
    const opens = logEvent.mock.calls.filter((c) => c[0] === "walkthrough.opened");
    expect(opens).toHaveLength(1);
    expect(opens[0]?.[2]).toEqual({
      variant: "personal",
      entry: "sidebar",
      days_since_signup_band: "0",
    });
  });

  it("records one section record per section reached, never one per render", () => {
    const { rerender } = render(<HowLassoWorksPage />);
    for (const fire of observed) fire();
    for (const fire of observed) fire();
    rerender(<HowLassoWorksPage />);
    const seen = logEvent.mock.calls.filter((c) => c[0] === "walkthrough.section_viewed");
    const ids = walkthroughFor("personal").sections.map((s) => s.id);
    expect(seen).toHaveLength(ids.length);
    expect(seen.map((c) => (c[2] as { section: string }).section).sort()).toEqual([...ids].sort());
    for (const call of seen) {
      const dims = call[2] as { variant: string; section: string; position: number };
      expect(dims.variant).toBe("personal");
      expect(typeof dims.position).toBe("number");
      expect(Object.keys(dims).sort()).toEqual(["position", "section", "variant"]);
    }
  });

  it("gives a coach the coaching walkthrough", () => {
    profileRef.current = { ...profileRef.current, role: "coach" } as Profile;
    render(<HowLassoWorksPage />);
    expect(screen.getByText("What you can and cannot see")).toBeTruthy();
    expect(screen.queryByText("Connect the AI you already use")).toBeNull();
    profileRef.current = { ...profileRef.current, role: "em" } as Profile;
  });
});
