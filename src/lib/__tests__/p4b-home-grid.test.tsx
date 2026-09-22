// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeEngagementGrid } from "@/components/home/HomeEngagementGrid";
import { NEVER_OPENED_LABEL, lastOpenedLabel, orderHomeGrid, countsByEngagement } from "@/lib/home-grid";
import { formatDate } from "@/lib/work-types";

const mocks = vi.hoisted(() => ({
  emitClientEvent: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params, onClick }: { children: React.ReactNode; params: { id: string }; onClick?: () => void }) => (
    <a href={`/engagements/${params.id}/canvas-lab`} onClick={onClick}>{children}</a>
  ),
}));

vi.mock("@/lib/client-telemetry", () => ({ emitClientEvent: mocks.emitClientEvent }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ upsert: mocks.upsert }) },
}));

afterEach(() => {
  cleanup();
  mocks.emitClientEvent.mockClear();
  mocks.upsert.mockReset();
});

const card = (id: string, lastViewedAt: string | null, workCount: number | null = 0) => ({
  id,
  code: `C-${id}`,
  title: `Title ${id}`,
  clientLabel: `Client ${id}`,
  lastViewedAt,
  workCount,
});

describe("the Home grid order", () => {
  it("puts the most recently opened first and the never opened last", () => {
    const ordered = orderHomeGrid([
      card("never-a", null),
      card("old", "2026-09-01T09:00:00.000Z"),
      card("new", "2026-09-21T09:00:00.000Z"),
      card("never-b", null),
    ]);
    expect(ordered.map((c) => c.id)).toEqual(["new", "old", "never-a", "never-b"]);
  });
});

describe("a Home card", () => {
  it("shows the date and time it was last opened, and a real count", () => {
    const iso = "2026-09-21T09:30:00.000Z";
    render(<HomeEngagementGrid cards={[card("one", iso, 3)]} />);
    expect(screen.getByTestId("home-card-when-one").textContent).toBe(lastOpenedLabel(iso));
    expect(screen.getByTestId("home-card-when-one").textContent).toContain(formatDate(iso));
    expect(screen.getByText(/3 pieces of work/)).toBeTruthy();
  });

  it("says a never-opened engagement is not opened yet, and never borrows another date", () => {
    const updatedAt = "2026-08-04T12:00:00.000Z";
    render(<HomeEngagementGrid cards={[card("two", null, 1)]} />);
    const when = screen.getByTestId("home-card-when-two");
    expect(when.textContent).toBe(NEVER_OPENED_LABEL);
    expect(document.body.textContent).not.toContain(formatDate(updatedAt));
  });

  it("leaves the count out entirely rather than showing a placeholder", () => {
    render(<HomeEngagementGrid cards={[card("three", null, null)]} />);
    expect(document.body.textContent).not.toMatch(/piece/);
    expect(document.body.textContent).not.toMatch(/—|--|\?\?/);
  });

  it("opens the board and records the content-free event", () => {
    render(<HomeEngagementGrid cards={[card("four", null)]} />);
    const link = screen.getByRole("link") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/engagements/four/canvas-lab");
    fireEvent.click(link);
    expect(mocks.emitClientEvent).toHaveBeenCalledWith("home.engagement_opened", {});
    expect(mocks.emitClientEvent.mock.calls.at(-1)?.[1]).toEqual({});
  });
});

describe("the work count", () => {
  it("counts a piece of work once however many workstreams hold it", () => {
    const counts = countsByEngagement([
      { work_item_id: "w1", engagement_id: "e1" },
      { work_item_id: "w1", engagement_id: "e1" },
      { work_item_id: "w2", engagement_id: "e1" },
      { work_item_id: "w3", engagement_id: "e2" },
    ]);
    expect(counts.get("e1")).toBe(2);
    expect(counts.get("e2")).toBe(1);
  });
});

describe("recording an open", () => {
  it("upserts one row on the primary key and updates the time on a second open", async () => {
    const { recordEngagementView } = await import("@/hooks/use-engagement-views");
    mocks.upsert.mockResolvedValue({ error: null });

    await recordEngagementView("p1", "e1");
    await recordEngagementView("p1", "e1");

    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    for (const call of mocks.upsert.mock.calls) {
      expect(call[0].profile_id).toBe("p1");
      expect(call[0].engagement_id).toBe("e1");
      expect(typeof call[0].last_viewed_at).toBe("string");
      expect(call[1]).toEqual({ onConflict: "profile_id,engagement_id" });
    }
  });
});
