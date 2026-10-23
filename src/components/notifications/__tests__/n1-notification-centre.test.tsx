// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rows: [] as unknown[],
  order: [] as string[],
  mark: vi.fn(async (_i: { data: { ids: string[]; acted: boolean } }) => ({ count: 1 })),
  rpc: vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
    data: { engagement_id: "board-elsewhere" } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  })),
  navigate: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/notifications.functions", () => ({
  listMyNotifications: async () => m.rows,
  markNotifications: (i: { data: { ids: string[]; acted: boolean } }) => {
    m.order.push(`mark:${i.data.acted}`);
    return m.mark(i);
  },
  recordNotificationOpened: async () => ({ ok: true }),
  recordNotificationActed: async () => ({ ok: true }),
  decideInvite: async () => ({ ok: true }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      m.order.push(`rpc:${fn}`);
      return m.rpc(fn, args);
    },
  },
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "own-profile", org_id: "own-org", display_name: "Jo Reed" } }),
}));
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => m.logEvent(...a) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => m.navigate }));

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { unreadCount, type NotificationRow } from "@/lib/notifications-shared";

function row(over: Partial<NotificationRow>): NotificationRow {
  return {
    id: "n1", org_id: "own-org", kind: "board_activity", section: "updates", subject_type: null, subject_id: null,
    payload: {}, created_at: "2026-10-22T01:00:00Z", read_at: null, acted_at: null, engagement_id: null, ...over,
  };
}

// The share lives in another workspace; the row sits in the recipient's own.
const share = row({
  id: "s1", kind: "share_received", section: "needs_you", org_id: "own-org",
  payload: { board: "Meridian margin review", by: "Liam Sheridan", code: "CODE123", level: "work" },
});

function mount(ui: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  m.order = [];
  (window as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  });
});
afterEach(cleanup);

describe("N1 unread count", () => {
  it("counts rows with read_at null in any section, nothing when zero", () => {
    expect(unreadCount([row({ read_at: null }), row({ read_at: null, section: "needs_you" }), row({ read_at: "x" })])).toBe("2");
    expect(unreadCount([row({ read_at: "x" })])).toBe("");
  });

  it("the bell shows the unread count and opening marks the visible unread rows read", async () => {
    m.rows = [share, row({ id: "u2" }), row({ id: "r3", read_at: "2026-10-21T00:00:00Z" })];
    mount(<NotificationBell />);
    const bell = await screen.findByRole("button", { name: "Notifications, 2 unread" });
    expect(screen.getByTestId("notification-count").textContent).toBe("2");
    fireEvent.click(bell);
    await waitFor(() => expect(m.mark).toHaveBeenCalledWith({ data: { ids: ["s1", "u2"], acted: false } }));
  });
});

describe("N1 accept a share from the bell", () => {
  it("renders a mention's two names with no acknowledgement control or body", () => {
    mount(<NotificationPanel rows={[row({ kind: "mention_received", section: "updates", payload: { by: "Liam Sheridan", board: "Pricing" } })]} onChanged={() => {}} onNavigate={() => {}} />);
    expect(screen.getByText("Liam Sheridan mentioned you on Pricing.")).toBeTruthy();
    // In updates, the only control is the row itself, which opens the board.
    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toContain("Liam Sheridan mentioned you on Pricing.");
  });
  it("names the board and who shared it, claims, marks acted, then opens the board", async () => {
    const onNavigate = vi.fn();
    mount(<NotificationPanel rows={[share]} onChanged={() => {}} onNavigate={onNavigate} />);
    expect(screen.getByText("Liam Sheridan shared Meridian margin review with you.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(m.navigate).toHaveBeenCalledWith({ to: "/engagements/$id/canvas-lab", params: { id: "board-elsewhere" } }));
    expect(m.rpc).toHaveBeenCalledWith("claim_board_invite", { p_code: "CODE123", p_display_name: "Jo Reed" });
    expect(m.mark).toHaveBeenCalledWith({ data: { ids: ["s1"], acted: true } });
    expect(m.order).toEqual(["rpc:claim_board_invite", "mark:true"]);
    expect(screen.getByText("Accepted.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    const accepted = m.logEvent.mock.calls.find((c) => c[0] === "board.invite_accepted");
    expect(accepted).toEqual(["board.invite_accepted", "own-org", { kind: "peer", level: "work", via: "bell" }]);
  });

  it("a failed claim shows its reason and leaves Accept on the row", async () => {
    m.rpc.mockResolvedValueOnce({ data: null, error: { message: "This invite has expired." } });
    mount(<NotificationPanel rows={[share]} onChanged={() => {}} onNavigate={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByText("This invite has expired.")).toBeTruthy();
    const again = screen.getByRole("button", { name: "Accept" }) as HTMLButtonElement;
    expect(again.disabled).toBe(false);
    expect(m.mark).not.toHaveBeenCalled();
    expect(m.navigate).not.toHaveBeenCalled();
  });

  it("an already accepted share reads Accepted, not gone", () => {
    mount(<NotificationPanel rows={[{ ...share, read_at: "x", acted_at: "x" }]} onChanged={() => {}} onNavigate={() => {}} />);
    expect(screen.getByText("Accepted.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  });
});
