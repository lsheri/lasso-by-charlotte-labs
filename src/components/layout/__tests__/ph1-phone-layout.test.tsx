// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
afterEach(() => cleanup());
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...p }: { children: React.ReactNode }) => <a {...(p as object)}>{children}</a>,
}));
vi.mock("@/components/feedback/FeedbackWidget", () => ({ FeedbackDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger }));

import { WorkspaceMenuItems } from "@/components/layout/WorkspaceMenuItems";
import { SettingsShell } from "@/components/settings/SettingsShell";

describe("PH-1 CS-7 More sheet Settings row", () => {
  it("renders Settings with the same row classes as a link neighbour", () => {
    render(
      <WorkspaceMenuItems
        items={[
          { id: "settings", label: "Settings", icon: "settings", action: "openSettings" } as never,
          { id: "connectors", label: "Where work comes from", icon: "connectors", to: "/connectors" } as never,
        ]}
        onOpened={() => {}}
        onSettings={() => {}}
        onSignOut={() => {}}
      />,
    );
    const settings = document.querySelector('[data-nav-item="settings"]')!;
    expect(settings.tagName).toBe("BUTTON");
    expect(settings.className).toBe("nb-nav-item min-h-[48px] w-full text-left");
    expect(settings.className).not.toMatch(/px-|h-auto|justify-start/);
  });
});

const sections = [
  { id: "a", label: "Account", hint: "who", group: "Account", title: "Account", content: <p>a</p> },
  { id: "w", label: "Workspace", hint: "facts", group: "Settings", title: "Workspace", content: <p>w</p> },
];

describe("PH-1 CS-8 Settings tabs at 390", () => {
  it("dialog rail scrolls in its own strip and leaves room for the close X", () => {
    render(<SettingsShell sections={sections as never} variant="dialog" defaultSection="a" />);
    const rail = screen.getByTestId("settings-rail");
    expect(rail.className).toContain("overflow-x-auto");
    expect(rail.className).toContain("min-w-0");
    // PH-1b: a right margin (not padding) shrinks the rail's visible box so
    // no tab rect can intersect the close X at any scroll position.
    expect(rail.className).toContain("mr-12");
    expect(rail.className).not.toContain("pr-14");
    // Desktop: the margin is undone and the column layout is kept.
    expect(rail.className).toContain("md:mr-0");
    expect(rail.className).toContain("md:flex-col");
    expect(rail.parentElement!.className).toContain("grid-cols-[minmax(0,1fr)]");
    expect(rail.parentElement!.className).toContain("md:grid-cols-[13rem_minmax(0,1fr)]");
  });

  it("the page variant gets no dialog padding", () => {
    render(<SettingsShell sections={sections as never} variant="page" defaultSection="a" />);
    expect(screen.getByTestId("settings-rail").className).not.toContain("pr-14");
  });
});
