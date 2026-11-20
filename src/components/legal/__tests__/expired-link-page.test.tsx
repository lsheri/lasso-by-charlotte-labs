// @vitest-environment jsdom
// 20 Nov 2026: the public page behind /r/<code>. It takes nothing in, so every code reads the same.
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { EXPIRED_LINK_COPY as COPY, ExpiredLinkPage } from "@/components/legal/ExpiredLinkPage";

afterEach(cleanup);

describe("the /r/<code> page", () => {
  it("says what the link was for, that it is not active, and links home", () => {
    render(<ExpiredLinkPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(COPY.heading);
    expect(screen.getByText(COPY.body)).toBeTruthy();
    expect(screen.getByRole("link", { name: COPY.home }).getAttribute("href")).toBe("/");
    expect(document.querySelectorAll("form, input, button").length).toBe(0);
  });

  it("takes no props, and its route reads no code, loads nothing and calls no server", () => {
    expect(ExpiredLinkPage.length).toBe(0);
    const route = readFileSync("src/routes/r.$code.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(route).not.toMatch(/params|useParams|loader|beforeLoad|ServerFn|functions"|supabase/);
    expect(route).toContain('{ name: "robots", content: "noindex" }');
  });

  it("has no long dash in its words", () => {
    expect(Object.values(COPY).join(" ")).not.toMatch(/[–—]/);
  });
});
