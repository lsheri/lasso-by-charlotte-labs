// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SIGNUP_BANNED_COPY } from "@/lib/signup-copy-laws";

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  Link: ({ children, to, search, ...props }: { children: ReactNode; to: string; search?: Record<string, string> }) => {
    const query = search ? `?${new URLSearchParams(search).toString()}` : "";
    return <a href={`${to}${query}`} {...props}>{children}</a>;
  },
  useNavigate: () => vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => vi.fn().mockResolvedValue({ ok: true }),
}));

import { PlansPage } from "@/routes/plans";

afterEach(cleanup);

describe("Unit B1: public plans", () => {
  it("shows all four plans with the approved destinations and copy", () => {
    const { container } = render(<PlansPage />);

    for (const heading of ["Just me", "School", "Team", "Partner"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }

    const getStarted = screen.getAllByRole("link", { name: "Get started" });
    expect(getStarted.map((link) => link.getAttribute("href"))).toEqual([
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