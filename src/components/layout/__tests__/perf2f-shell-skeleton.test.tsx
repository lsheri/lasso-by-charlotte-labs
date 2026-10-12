// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppShell", () => ({ AppShell: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/use-profile", () => ({ ensureAuthUser: vi.fn(), ensureProfileState: vi.fn() }));

import { AppShellSkeleton } from "@/components/layout/AppShellSkeleton";
import { Route } from "@/routes/_authenticated/route";

afterEach(cleanup);

describe("PERF-2f app frame placeholder", () => {
  it("is busy with only the brand and one visually hidden opening label", () => {
    const { container } = render(<AppShellSkeleton />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    const label = screen.getByText("Opening Lasso");
    expect(label.className).toBe("sr-only");
    expect(screen.getAllByText("LASSO")).toHaveLength(2);
    const copy = container.textContent?.replace("Opening Lasso", "").replaceAll("LASSO", "").trim();
    expect(copy).toBe("");
    expect(container.querySelectorAll("button, a, input")).toHaveLength(0);
    const blocks = container.querySelectorAll(".animate-pulse");
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) expect(block.classList.contains("motion-reduce:animate-none")).toBe(true);
  });

  it("contains no colour literals", () => {
    const source = readFileSync("src/components/layout/AppShellSkeleton.tsx", "utf8");
    expect(source).not.toMatch(/#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\(/i);
  });

  it("uses the placeholder after 150ms with a 200ms minimum", () => {
    expect(Route.options.pendingComponent).toBe(AppShellSkeleton);
    expect(Route.options.pendingMs).toBe(150);
    expect(Route.options.pendingMinMs).toBe(200);
    const source = readFileSync("src/routes/_authenticated/route.tsx", "utf8");
    expect(source).toContain("ssr: false,");
  });
});