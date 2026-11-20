// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_HOME_COPY, type AdminFeed, type FeedItem } from "@/lib/admin-home-shared";
import { OPEN_NOTIFICATIONS_EVENT } from "@/lib/notifications-shared";
import type { DeskList, DeskProposal } from "@/lib/proposal-desk-shared";

/**
 * 21 Nov 2026, D-82: an admin's Home. The two lists, an item morphing into its next step, new items growing in with
 * the lime mark, the one tap into Proposals, the reads on focus and every minute, and a source that fails.
 */

const m = vi.hoisted(() => ({ list: vi.fn(), roster: vi.fn(), notes: vi.fn(), navigate: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className, ...rest }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className} data-testid={(rest as { "data-testid"?: string })["data-testid"]}>{children}</a>
  ),
  useNavigate: () => m.navigate,
}));
vi.mock("@/lib/proposal-desk.functions", () => ({ listProposalsFn: m.list }));
vi.mock("@/lib/roster.functions", () => ({ listRosterFn: m.roster }));
vi.mock("@/lib/notifications.functions", () => ({ listMyNotifications: m.notes }));

import { AdminHome, AdminWhatChanged } from "@/components/home/AdminHome";

const NOW = Date.now();
const hoursAgo = (n: number) => new Date(NOW - n * 3_600_000).toISOString();
const admin = { id: "11111111-1111-4111-8111-111111111111", role: "admin", org_type: "company", has_firm_view: true };
const proposal = (over: Partial<DeskProposal>): DeskProposal => ({
  id: "p1", title: "Network redesign", clientName: "Pellham", ownerName: "Harper Quinn", mine: false, status: "open",
  receivedAt: hoursAgo(90), sentAt: null, decidedAt: null, engagementId: null, contextCount: 1, canAct: true, canClose: true, canArchive: true,
  leadContactId: "c1", leadName: "Christy Johnson", ask: null, ...over,
});
const desk = (proposals: DeskProposal[]): DeskList => ({ goalHours: 72, canSetGoal: true, canPickLead: true, canAddClient: true, texts: { demo: true, connected: false }, proposals });
const item = (id: string, over: Partial<FeedItem> = {}): FeedItem => ({
  id, kind: "over", at: hoursAgo(1), title: `Title ${id}`, detail: "Pellham: Network redesign · 5 hours over", next: { label: "Open the proposal", why: "It is past the goal.", step: { to: "/proposals", search: { proposal: id } } }, ...over,
});
const feed = (waiting: FeedItem[], today: FeedItem[] = [], todayMore = 0): AdminFeed => ({ waiting, today, todayMore });

function mount(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{node}</QueryClientProvider>) };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const fn of Object.values(m)) fn.mockReset();
});

describe("the lists", () => {
  it("shows a skeleton of the lists until the first read settles, with one status line", () => {
    render(<AdminWhatChanged feed={null} failed={false} open={null} onRetry={() => {}} onStep={() => {}} />);
    expect(screen.getByTestId("admin-home-skeleton")).toBeTruthy();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText(ADMIN_HOME_COPY.loading)).toBeTruthy();
  });

  it("puts what waits on the admin first, then earlier today, and says so plainly when either is empty", () => {
    const view = render(<AdminWhatChanged feed={feed([item("a")], [item("b", { kind: "won" })])} failed={false} open={2} onRetry={() => {}} onStep={() => {}} />);
    const waiting = screen.getByTestId("admin-home-waiting");
    const today = screen.getByTestId("admin-home-today");
    expect(waiting.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(waiting).getByText("Title a")).toBeTruthy();
    view.rerender(<AdminWhatChanged feed={feed([], [])} failed={false} open={0} onRetry={() => {}} onStep={() => {}} />);
    expect(screen.getByText(ADMIN_HOME_COPY.nothingWaiting)).toBeTruthy();
    expect(screen.getByText(ADMIN_HOME_COPY.nothingToday)).toBeTruthy();
  });

  it("shows the time of day only on earlier today, never on a waiting item", () => {
    render(<AdminWhatChanged feed={feed([item("a")], [item("b", { kind: "sent" }), item("c", { kind: "said_yes", at: "" })])} failed={false} open={1} onRetry={() => {}} onStep={() => {}} />);
    const time = (id: string) => document.querySelector(`[data-feed-item="${id}"] .font-mono`);
    expect(time("a")).toBeNull();
    expect(time("b")?.textContent).toMatch(/\d{1,2}:\d{2}/);
    expect(time("c")).toBeNull();
  });

  it("keeps Proposals one tap away, with how many are open", () => {
    render(<AdminWhatChanged feed={feed([])} failed={false} open={3} onRetry={() => {}} onStep={() => {}} />);
    const link = screen.getByTestId("admin-home-up-next");
    expect(link.getAttribute("href")).toBe("/proposals");
    expect(link.textContent).toContain(ADMIN_HOME_COPY.upNext);
    expect(link.textContent).toContain("3 open proposals");
  });

  it("points to Proposals for the rest of a long day", () => {
    render(<AdminWhatChanged feed={feed([], [item("b")], 4)} failed={false} open={1} onRetry={() => {}} onStep={() => {}} />);
    expect(screen.getByRole("link", { name: ADMIN_HOME_COPY.more(4) }).getAttribute("href")).toBe("/proposals");
  });
});

describe("an item morphs into its next step", () => {
  it("opens on press with Next and Why written on it, takes the step, and closes again", () => {
    const onStep = vi.fn();
    render(<AdminWhatChanged feed={feed([item("a"), item("b")])} failed={false} open={2} onRetry={() => {}} onStep={onStep} />);
    const row = screen.getByRole("button", { name: /Title a/ });
    expect(row.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector("[data-feed-next]")).toBeNull();
    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    const next = document.querySelector("[data-feed-next]") as HTMLElement;
    expect(next.textContent).toContain("Next: Open the proposal");
    expect(next.textContent).toContain("Why: It is past the goal.");
    // Only one item is open at a time.
    fireEvent.click(screen.getByRole("button", { name: /Title b/ }));
    expect(row.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(within(document.querySelector("[data-feed-next]") as HTMLElement).getByRole("button", { name: "Open the proposal" }));
    expect(onStep).toHaveBeenCalledWith({ to: "/proposals", search: { proposal: "b" } });
    fireEvent.click(screen.getByRole("button", { name: ADMIN_HOME_COPY.close }));
    expect(document.querySelector("[data-feed-next]")).toBeNull();
  });
});

describe("new items", () => {
  it("marks nothing on the first read, then grows in only what arrived, once", () => {
    const view = render(<AdminWhatChanged feed={feed([item("a")])} failed={false} open={1} onRetry={() => {}} onStep={() => {}} />);
    expect(document.querySelector("[data-feed-new]")).toBeNull();
    view.rerender(<AdminWhatChanged feed={feed([item("n"), item("a")])} failed={false} open={1} onRetry={() => {}} onStep={() => {}} />);
    const fresh = document.querySelector('[data-feed-item="n"]') as HTMLElement;
    expect(fresh.getAttribute("data-feed-new")).toBe("true");
    expect(fresh.className).toContain("ah-arrive");
    expect(fresh.querySelector(".ah-skel")).toBeTruthy();
    expect(fresh.querySelector(".ah-mark")).toBeTruthy();
    expect(document.querySelector('[data-feed-item="a"]')?.getAttribute("data-feed-new")).toBeNull();
    // The same list again (a re-render or a read with nothing new) marks nothing more.
    view.rerender(<AdminWhatChanged feed={feed([item("n"), item("a")])} failed={false} open={1} onRetry={() => {}} onStep={() => {}} />);
    expect(document.querySelector('[data-feed-item="n"]')?.getAttribute("data-feed-new")).toBe("true");
    view.rerender(<AdminWhatChanged feed={feed([item("x"), item("n"), item("a")])} failed={false} open={1} onRetry={() => {}} onStep={() => {}} />);
    expect(document.querySelector('[data-feed-item="n"]')?.getAttribute("data-feed-new")).toBeNull();
    expect(document.querySelector('[data-feed-item="x"]')?.getAttribute("data-feed-new")).toBe("true");
  });

  it("does not mark an item as new when it comes back after leaving", () => {
    const view = render(<AdminWhatChanged feed={feed([item("a"), item("b")])} failed={false} open={1} onRetry={() => {}} onStep={() => {}} />);
    view.rerender(<AdminWhatChanged feed={feed([item("a")])} failed={false} open={1} onRetry={() => {}} onStep={() => {}} />);
    view.rerender(<AdminWhatChanged feed={feed([item("a"), item("b")])} failed={false} open={1} onRetry={() => {}} onStep={() => {}} />);
    expect(document.querySelector("[data-feed-new]")).toBeNull();
  });
});

describe("reading", () => {
  it("reads the proposals, People and notifications, then draws the lists from them", async () => {
    m.list.mockResolvedValue(desk([proposal({ id: "late" }), proposal({ id: "won", status: "won", receivedAt: hoursAgo(200), decidedAt: hoursAgo(0.2), engagementId: "e1" })]));
    m.roster.mockResolvedValue({ allowed: true, contacts: [{ id: "c9", name: "Dana West", needsDetails: true }] });
    m.notes.mockResolvedValue([{ id: "n1", org_id: "o", kind: "invite_needs_approval", section: "needs_you", subject_type: "board_invite", subject_id: "i", payload: { by: "Ana", email: "a@b.co", board: "Pricing" }, created_at: hoursAgo(1), read_at: null, acted_at: null, engagement_id: null }]);
    mount(<AdminHome profile={admin} />);
    await waitFor(() => expect(screen.getByTestId("admin-home-waiting")).toBeTruthy());
    expect([...document.querySelectorAll("[data-feed-kind]")].map((node) => node.getAttribute("data-feed-kind"))).toEqual(["over", "invite", "people", "won"]);
    expect(m.list.mock.calls[0]?.[0]).toMatchObject({ data: { profile_id: admin.id } });
    expect(typeof m.list.mock.calls[0]?.[0].data.day_start).toBe("string");
    expect(m.roster).toHaveBeenCalledWith({ data: { profile_id: admin.id } });
    expect(screen.getByTestId("admin-home-up-next").textContent).toContain("1 open proposal");
  });

  it("takes each step where it goes: Proposals, the board, or the bell", async () => {
    m.list.mockResolvedValue(desk([proposal({ id: "late" }), proposal({ id: "won", status: "won", receivedAt: hoursAgo(200), decidedAt: hoursAgo(0.2), engagementId: "e1" })]));
    m.roster.mockResolvedValue({ allowed: true, contacts: [] });
    m.notes.mockResolvedValue([{ id: "n1", org_id: "o", kind: "invite_needs_approval", section: "needs_you", subject_type: null, subject_id: null, payload: {}, created_at: hoursAgo(1), read_at: null, acted_at: null, engagement_id: null }]);
    const bell = vi.fn();
    window.addEventListener(OPEN_NOTIFICATIONS_EVENT, bell);
    try {
      mount(<AdminHome profile={admin} />);
      await waitFor(() => expect(screen.getByTestId("admin-home-waiting")).toBeTruthy());
      const go = (id: string, label: string) => {
        fireEvent.click(within(document.querySelector(`[data-feed-item="${id}"]`) as HTMLElement).getAllByRole("button")[0]!);
        fireEvent.click(within(document.querySelector(`[data-feed-item="${id}"] [data-feed-next]`) as HTMLElement).getByRole("button", { name: label }));
      };
      go("wait:late", "Open the proposal");
      expect(m.navigate).toHaveBeenLastCalledWith({ to: "/proposals", search: { proposal: "late" } });
      go("won:won", "Open the team board");
      expect(m.navigate).toHaveBeenLastCalledWith({ to: "/engagements/$id/canvas-lab", params: { id: "e1" } });
      go("invite:n1", "Approve or decline");
      expect(bell).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(OPEN_NOTIFICATIONS_EVENT, bell);
    }
  });

  it("keeps what it could read when one source fails, says so, and Try again reads only that one", async () => {
    m.list.mockResolvedValue(desk([proposal({ id: "late" })]));
    m.roster.mockRejectedValueOnce(new Error("down"));
    m.notes.mockResolvedValue([]);
    mount(<AdminHome profile={admin} />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(ADMIN_HOME_COPY.partFailed));
    expect(document.querySelector('[data-feed-item="wait:late"]')).toBeTruthy();
    m.roster.mockResolvedValue({ allowed: true, contacts: [{ id: "c9", name: "Dana West", needsDetails: true }] });
    const listCalls = m.list.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: ADMIN_HOME_COPY.retry }));
    await waitFor(() => expect(document.querySelector('[data-feed-item="people:missing"]')).toBeTruthy());
    expect(m.list.mock.calls.length).toBe(listCalls);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reads again once a minute and when the window comes back into focus (D-85), with no realtime", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    m.list.mockResolvedValue(desk([]));
    m.roster.mockResolvedValue({ allowed: true, contacts: [] });
    m.notes.mockResolvedValue([]);
    mount(<AdminHome profile={admin} />);
    await waitFor(() => expect(m.list).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    await waitFor(() => expect(m.list).toHaveBeenCalledTimes(2));
    expect(m.roster.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(m.notes.mock.calls.length).toBeGreaterThanOrEqual(2);
    // Back into focus after the cache has gone stale: read again at once.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(m.list).toHaveBeenCalledTimes(3));
    focusManager.setFocused(undefined);
    const source = (await import("node:fs")).readFileSync("src/components/home/AdminHome.tsx", "utf8");
    expect(source).not.toMatch(/channel\(|subscribe\(|realtime/i);
  });

  it("asks for nothing and shows nothing for anyone but an admin of a company workspace", async () => {
    for (const profile of [null, undefined, { ...admin, role: "lead" }, { ...admin, is_guest: true }, { ...admin, org_type: "personal", has_firm_view: false }]) {
      mount(<AdminHome profile={profile} />);
      expect(screen.queryByTestId("admin-home")).toBeNull();
      cleanup();
    }
    await Promise.resolve();
    expect(m.list).not.toHaveBeenCalled();
    expect(m.roster).not.toHaveBeenCalled();
    expect(m.notes).not.toHaveBeenCalled();
  });
});
