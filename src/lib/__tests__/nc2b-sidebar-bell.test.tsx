// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({ useServerFn: () => async () => [] }));
vi.mock("@/lib/notifications.functions", () => ({
  listMyNotifications: async () => [],
  markNotifications: async () => {},
  recordNotificationOpened: async () => {},
}));
vi.mock("@/components/notifications/NotificationPanel", () => ({ NotificationPanel: () => null }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: Record<string, unknown>) => <a {...props}>{children as ReactNode}</a>,
}));
vi.mock("@/components/layout/WorkspaceMenu", () => ({ WorkspaceMenu: () => null }));
vi.mock("@/components/layout/SidebarNav", () => ({ SidebarNav: () => null }));

import { AppSidebar } from "@/components/layout/AppSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";

function mount(ui: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  (window as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
});
afterEach(cleanup);

describe("nc2b bell moves into the sidebar", () => {
  it("AppShell no longer renders the desktop sticky overlay and keeps the phone bell", () => {
    const shell = readFileSync("src/components/layout/AppShell.tsx", "utf8");
    expect(shell).not.toContain("desktop has no top bar");
    expect(shell).not.toContain("pointer-events-none sticky top-0 z-40");
    // The phone header bell stays.
    expect(shell).toContain("<NotificationBell />");
  });

  it("AppSidebar renders the bell on the brand row, right of the LASSO wordmark", () => {
    mount(
      <AppSidebar userName="Liam" userRole="member" profiles={[]} activeProfile={null} onSignOut={() => {}} />,
    );
    const brandRow = screen.getByText("LASSO").closest("div")!.parentElement!;
    expect(within(brandRow).getByRole("button", { name: /Notifications/ })).toBeTruthy();
  });

  it("the desktop popover opens to the right of the bell", async () => {
    mount(<NotificationBell side="right" align="start" />);
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    const content = await waitFor(() => {
      const el = document.querySelector<HTMLElement>("[data-side='right']");
      if (!el) throw new Error("popover not open yet");
      return el;
    });
    expect(content.getAttribute("data-align")).toBe("start");
  });

  it("the workboard rail shows the bell under the logo, md and up only", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain('<NotificationBell side="right" align="start" />');
    expect(page).toMatch(/hidden md:flex">\s*\n\s*<NotificationBell/);
  });

  it("keeps the 44px hit area", () => {
    const bell = readFileSync("src/components/notifications/NotificationBell.tsx", "utf8");
    expect(bell).toContain("h-11 w-11");
  });
});
