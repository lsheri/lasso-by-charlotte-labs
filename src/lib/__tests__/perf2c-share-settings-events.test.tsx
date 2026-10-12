// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));
vi.mock("@/hooks/use-profile", () => ({
  ensureProfileState: async () => ({ profiles: [{ id: "p1", org_id: "org1" }], hasDeactivated: false }),
  fetchProfile: async () => ({ id: "p1", org_id: "org1" }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/components/canvas-lab/ShareBoardDialog", () => ({ BoardLinkSection: () => null }));
vi.mock("@/lib/board-invites.functions", () => ({
  inviteToBoard: vi.fn(), listBoardInvites: vi.fn(async () => []), withdrawBoardInvite: vi.fn(),
}));
vi.mock("@/lib/engagement-access.functions", () => ({
  listEngagementPeopleFn: vi.fn(async () => ({ people: [], canManage: false })),
  setEngagementPersonAccessFn: vi.fn(), setPersonConversationsFn: vi.fn(),
}));
vi.mock("@/lib/partner-share", () => ({
  getBoardConversationAccess: vi.fn(async () => null), listMyPartnerShares: vi.fn(async () => []),
  setBoardConversationAccess: vi.fn(), listSharedEngagements: vi.fn(async () => []),
  partnerShareLabel: () => "", shareEngagement: vi.fn(), unshareEngagement: vi.fn(),
}));

import { ShareDialog } from "@/components/canvas-lab/ShareDialog";
import { SettingsShell, type SettingsSection } from "@/components/settings/SettingsShell";

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

const SECTIONS: SettingsSection[] = [
  { id: "account", label: "Account", hint: "a", content: <p>acc</p> },
  { id: "your-data", label: "Your data", hint: "b", content: <p>data</p> },
  { id: "support", label: "Support access", hint: "c", content: <p>sup</p> },
];

const calls = (name: string) => logEvent.mock.calls.filter((c) => c[0] === name);

describe("PERF-2c events", () => {
  beforeEach(() => logEvent.mockClear());

  it("(a) opening Share fires board.share_opened once; closing fires nothing", async () => {
    wrap(<ShareDialog engagementId="e1" profileId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(calls("board.share_opened")).toEqual([["board.share_opened", "org1", {}]]));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await new Promise((r) => setTimeout(r, 20));
    expect(calls("board.share_opened")).toHaveLength(1);
  });

  it("(b) rail click to Your data fires via rail, (c) repeat fires nothing", async () => {
    wrap(<SettingsShell sections={SECTIONS} variant="dialog" />);
    await waitFor(() => expect(calls("settings.section_opened")).toEqual([
      ["settings.section_opened", "org1", { section: "account", via: "default" }],
    ]));
    logEvent.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Your data/ }));
    await waitFor(() => expect(calls("settings.section_opened")).toEqual([
      ["settings.section_opened", "org1", { section: "your-data", via: "rail" }],
    ]));
    fireEvent.click(screen.getByRole("button", { name: /Your data/ }));
    await new Promise((r) => setTimeout(r, 20));
    expect(calls("settings.section_opened")).toHaveLength(1);
  });

  it("(d) opening onto support access fires via deep_link", async () => {
    wrap(<SettingsShell sections={SECTIONS} variant="dialog" initialSection="support" />);
    await waitFor(() => expect(calls("settings.section_opened")).toEqual([
      ["settings.section_opened", "org1", { section: "support", via: "deep_link" }],
    ]));
  });
});
