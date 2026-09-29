// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SIGNUP_BANNED_COPY } from "@/lib/signup-copy-laws";

const emitted = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  Link: ({ children, to, search, ...props }: { children: ReactNode; to: string; search?: Record<string, string> }) => {
    const query = search ? `?${new URLSearchParams(search).toString()}` : "";
    return <a href={`${to}${query}`} {...props}>{children}</a>;
  },
  useNavigate: () => vi.fn(),
}));
vi.mock("@tanstack/react-start", async (orig) => ({
  ...(await orig<object>()),
  useServerFn: () => vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/posthog-client", () => ({
  captureFunnelEvent: (event: string, dims: Record<string, unknown>) => emitted.push([event, dims]),
}));

import { PlansPage, validatePlansSearch } from "@/routes/plans";

afterEach(() => {
  cleanup();
  emitted.length = 0;
});

function hrefs() {
  return screen.getAllByRole("link", { name: "Get started" }).map((link) => link.getAttribute("href"));
}

describe("Unit B1: public plans", () => {
  it("shows all four plans with the approved destinations and copy", () => {
    const { container } = render(<PlansPage />);

    for (const heading of ["Just me", "School", "Team", "Partner"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }

    expect(hrefs()).toEqual([
      "/auth?intent=personal",
      "/auth?intent=edu",
      "/auth?intent=company",
    ]);

    const comingSoon = screen.getByRole("button", { name: "Coming soon" });
    expect(comingSoon.getAttribute("aria-disabled")).toBe("true");
    expect(comingSoon.closest("a")).toBeNull();
    expect(container.querySelector('a[href^="/auth?intent=partner"]')).toBeNull();

    const wholePage = container.textContent ?? "";
    expect(wholePage).not.toMatch(SIGNUP_BANNED_COPY);
    expect(wholePage).not.toContain("\u2014");
  });
});

describe("Unit D1: funnel source", () => {
  it("keeps src=front_door on all three Get started links", () => {
    render(<PlansPage search={validatePlansSearch({ src: "front_door" })} />);
    expect(hrefs()).toEqual([
      "/auth?intent=personal&src=front_door",
      "/auth?intent=edu&src=front_door",
      "/auth?intent=company&src=front_door",
    ]);
    expect(emitted).toContainEqual(["plans.viewed", { src: "front_door" }]);
  });

  it("drops an unknown src value entirely", () => {
    const search = validatePlansSearch({ src: "billboard" });
    expect(search).toEqual({});
    render(<PlansPage search={search} />);
    for (const href of hrefs()) expect(href).not.toContain("src=");
  });

  it("keeps from and src together on one URL", () => {
    const search = validatePlansSearch({ src: "front_door", from: "artemis" });
    expect(search).toEqual({ src: "front_door", from: "artemis" });
    render(<PlansPage search={search} />);
    expect(hrefs()).toEqual([
      "/auth?intent=personal&src=front_door&from=artemis",
      "/auth?intent=edu&src=front_door&from=artemis",
      "/auth?intent=company&src=front_door&from=artemis",
    ]);
  });

  it("fires plan.picked on a Get started click and nothing for Coming soon", () => {
    render(<PlansPage search={validatePlansSearch({ src: "front_door" })} />);
    screen.getAllByRole("link", { name: "Get started" })[2]!.click();
    screen.getByRole("button", { name: "Coming soon" }).click();
    expect(emitted.filter(([name]) => name === "plan.picked")).toEqual([
      ["plan.picked", { plan: "company", src: "front_door" }],
    ]);
  });
});
