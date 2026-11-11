// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  mark: vi.fn(async (_i: { data: { ids: string[]; acted: boolean } }) => ({ count: 1 })),
  done: vi.fn(async (_i: { data: { id: string; done: boolean } }) => ({ status: "saved" }) as { status: string }),
  navigate: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/notifications.functions", () => ({
  markNotifications: (i: { data: { ids: string[]; acted: boolean } }) => m.mark(i),
  recordNotificationActed: async () => ({ ok: true }),
  decideInvite: async () => ({ ok: true }),
}));
vi.mock("@/lib/stickies.functions", () => ({ setStickyDoneFn: (i: { data: { id: string; done: boolean } }) => m.done(i) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "ben", org_id: "own-org", display_name: "Ben" } }) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => m.logEvent(...a) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => m.navigate }));
vi.mock("@/components/layout/SharedWithYou", () => ({
  SHARED_WITH_YOU_COPY: { open: "Open" },
  useAcceptBoardShare: () => vi.fn(),
  useOpenShared: () => vi.fn(),
}));

import { NotificationPanel, STICKY_ROW_COPY } from "@/components/notifications/NotificationPanel";
import { NOTIFICATION_COPY, type NotificationRow } from "@/lib/notifications-shared";

const payload = { by: "Liam", board: "CS Program Recommendation", work: "CVCC deck", place: "Slide 3", sticky_id: "s1", work_item_id: "w1" };
function row(over: Partial<NotificationRow>): NotificationRow {
  return {
    id: "n1", org_id: "board-org", kind: "sticky_assigned", section: "needs_you", subject_type: "engagement", subject_id: "eng",
    payload, created_at: "2026-11-10T01:00:00Z", read_at: null, acted_at: null, engagement_id: "eng", ...over,
  };
}
const onChanged = vi.fn();
function mount(ui: ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("S4b-2 a sticky someone asks of you", () => {
  it("sits in Needs you, says where it is, and opens right on the spot", () => {
    mount(<NotificationPanel rows={[row({})]} onChanged={onChanged} onNavigate={vi.fn()} />);
    expect(screen.getByText("Liam left you a sticky on CVCC deck, Slide 3.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: NOTIFICATION_COPY.openSticky }));
    expect(m.navigate).toHaveBeenCalledWith({
      to: "/engagements/$id/canvas-lab",
      params: { id: "eng" },
      search: { sticky: "s1", work: "w1" },
    });
    // Opening reads it; it stays in Needs you until the sticky is done.
    expect(m.mark).toHaveBeenCalledWith({ data: { ids: ["n1"], acted: false } });
  });
  it("Mark done ticks the sticky from here, settles the row and records it came from the inbox", async () => {
    mount(<NotificationPanel rows={[row({})]} onChanged={onChanged} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: NOTIFICATION_COPY.markDone }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(NOTIFICATION_COPY.markedDone));
    expect(m.done).toHaveBeenCalledWith({ data: { id: "s1", done: true } });
    expect(m.mark).toHaveBeenCalledWith({ data: { ids: ["n1"], acted: true } });
    expect(m.logEvent).toHaveBeenCalledWith("workboard.sticky_done", "board-org", { via: "inbox" });
  });
  it("a sticky that moved on says so and is not marked done", async () => {
    m.done.mockResolvedValueOnce({ status: "conflict" });
    mount(<NotificationPanel rows={[row({})]} onChanged={onChanged} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: NOTIFICATION_COPY.markDone }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(STICKY_ROW_COPY.movedOn));
    expect(m.logEvent).not.toHaveBeenCalled();
    expect(m.mark).not.toHaveBeenCalled();
  });
});

describe("S4b-2 your sticky is done", () => {
  it("reads in Updates and opens on the spot", () => {
    mount(<NotificationPanel rows={[row({ kind: "sticky_done", section: "updates", payload: { ...payload, by: "Ben" } })]} onChanged={onChanged} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByText("Ben marked your sticky on CVCC deck, Slide 3 done."));
    expect(m.navigate).toHaveBeenCalledWith(expect.objectContaining({ search: { sticky: "s1", work: "w1" } }));
    expect(m.mark).toHaveBeenCalledWith({ data: { ids: ["n1"], acted: true } });
  });
  it("the board's count opens the board, nothing more", () => {
    mount(<NotificationPanel rows={[row({ kind: "board_activity", section: "updates", payload: { board: "CS Program Recommendation", what: "stickies_done", count: 2 } })]} onChanged={onChanged} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByText("CS Program Recommendation: 2 stickies done."));
    expect(m.navigate).toHaveBeenCalledWith({ to: "/engagements/$id/canvas-lab", params: { id: "eng" } });
  });
});
