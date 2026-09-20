// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  ARRIVAL_LIMIT,
  arrivalPlace,
  arrivalWhen,
  isConnectorArrival,
  selectArrivals,
} from "@/lib/inbox-arrivals";
import type { WorkItemRow } from "@/lib/work-types";

const NOW = new Date("2026-09-20T12:00:00.000Z").getTime();
const day = 24 * 60 * 60 * 1000;

function item(over: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: over.id ?? "i1",
    owner_id: "me",
    client_id: null,
    title: "A chat",
    type: "ai_thread",
    source: "mcp:claude",
    visibility: "unmapped",
    captured_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
    content_ref: null,
    created_at_source: null,
    work_date: null,
    content_fidelity: null,
    source_vendor: "claude",
    orig_conversation_id: null,
    source_meta: null,
    meta: null,
    work_item_tasks: [],
    ...over,
  } as WorkItemRow;
}

function mappedTo(code: string, name: string) {
  return [
    {
      task_id: "t1",
      tasks: {
        id: "t1",
        name,
        engagement_id: "e1",
        engagements: { id: "e1", code, title: "Diagnostic" },
      },
    },
  ] as WorkItemRow["work_item_tasks"];
}

describe("M3 — which arrivals the strip shows", () => {
  it("keeps only connector pushes", () => {
    expect(isConnectorArrival({ source: "mcp:claude" })).toBe(true);
    expect(isConnectorArrival({ source: "mcp" })).toBe(true);
    expect(isConnectorArrival({ source: "upload" })).toBe(false);
    expect(isConnectorArrival({ source: null })).toBe(false);
    const rows = selectArrivals(
      [item({ id: "a" }), item({ id: "b", source: "upload" }), item({ id: "c", source: "paste" })],
      "me",
      NOW,
    );
    expect(rows.map((r) => r.id)).toEqual(["a"]);
  });

  it("keeps only the last seven days, newest first", () => {
    const rows = selectArrivals(
      [
        item({ id: "old", captured_at: new Date(NOW - 8 * day).toISOString() }),
        item({ id: "edge", captured_at: new Date(NOW - 6.9 * day).toISOString() }),
        item({ id: "fresh", captured_at: new Date(NOW - 1 * day).toISOString() }),
        item({ id: "nodate", captured_at: undefined as unknown as string }),
      ],
      "me",
      NOW,
    );
    expect(rows.map((r) => r.id)).toEqual(["fresh", "edge"]);
  });

  it("keeps only the signed-in owner's own pushes", () => {
    const rows = selectArrivals([item({ id: "mine" }), item({ id: "theirs", owner_id: "you" })], "me", NOW);
    expect(rows.map((r) => r.id)).toEqual(["mine"]);
    expect(selectArrivals([item()], null, NOW)).toEqual([]);
  });

  it("caps the visible rows at eight", () => {
    expect(ARRIVAL_LIMIT).toBe(8);
  });

  it("says when it arrived without over-claiming precision", () => {
    expect(arrivalWhen(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("just now");
    expect(arrivalWhen(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe("3h ago");
    expect(arrivalWhen(new Date(NOW - 2 * day).toISOString(), NOW)).toBe("2d ago");
  });
});

describe("M3 — where it is now, in the workspace's words", () => {
  it("a company workspace reads Placed on", () => {
    const place = arrivalPlace(item({ work_item_tasks: mappedTo("CFT-01", "General") }), "company");
    expect(place.text).toBe("Placed on CFT-01 · General");
    expect(place.mapped).toBe(true);
  });

  it("personal and school workspaces read Filed under", () => {
    for (const type of ["personal", "edu"] as const) {
      const place = arrivalPlace(item({ work_item_tasks: mappedTo("NWG-02", "Week 3") }), type);
      expect(place.text).toBe("Filed under NWG-02 · Week 3");
    }
  });

  it("an unmapped arrival says where it is, never who saw it", () => {
    const place = arrivalPlace(item(), "company");
    expect(place).toEqual({ mapped: false, text: "In your inbox" });
  });

  it("never says tracked, monitored or synced", () => {
    const words = [
      arrivalPlace(item({ work_item_tasks: mappedTo("CFT-01", "General") }), "company").text,
      arrivalPlace(item(), "personal").text,
    ].join(" ");
    expect(words).not.toMatch(/track|monitor|sync/i);
  });
});

/* ---------- the strip itself: Undo and Put it back ---------- */

const deletes: string[] = [];
const inserts: { work_item_id: string; task_id: string }[] = [];
const events: { name: string; dims: Record<string, unknown> }[] = [];

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "me", org_id: "org", org_type: "company" } }),
}));

vi.mock("@/lib/telemetry", () => ({
  logEvent: (name: string, _org: string, dims: Record<string, unknown>) =>
    events.push({ name, dims }),
}));

vi.mock("@/components/work/SourceMark", () => ({ SourceMark: () => null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      delete: () => ({
        eq: (_col: string, id: string) => {
          deletes.push(id);
          return Promise.resolve({ error: null });
        },
      }),
      insert: (row: { work_item_id: string; task_id: string }) => {
        inserts.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

const toasts: { text: string; action: { label: string; onClick: () => void } | undefined }[] = [];
vi.mock("sonner", () => {
  const toast = Object.assign(
    (text: string, opts?: { action?: { label: string; onClick: () => void } }) => {
      toasts.push({ text, action: opts?.action });
    },
    { error: () => {}, success: () => {} },
  );
  return { toast };
});

import { ArrivalsStrip } from "@/components/work/ArrivalsStrip";

function renderStrip(items: WorkItemRow[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ArrivalsStrip items={items} />
    </QueryClientProvider>,
  );
}

describe("M3 — Undo and Put it back", () => {
  beforeEach(() => {
    deletes.length = 0;
    inserts.length = 0;
    events.length = 0;
    toasts.length = 0;
  });

  afterEach(() => cleanup());

  it("shows nothing when no connector work arrived", () => {
    const { container } = renderStrip([item({ source: "upload" })]);
    expect(container.textContent).toBe("");
  });

  it("undoes a placement, records it, and can put it back", async () => {
    renderStrip([item({ id: "i1", work_item_tasks: mappedTo("CFT-01", "General") })]);
    expect(screen.getByText("Placed on CFT-01 · General")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(deletes).toEqual(["i1"]));
    expect(events).toEqual([{ name: "inbox.arrival_undone", dims: { reverted: false } }]);
    expect(toasts[0]?.text).toBe("Moved back to your inbox.");
    expect(toasts[0]?.action?.label).toBe("Put it back");

    toasts[0]?.action?.onClick();
    await waitFor(() => expect(inserts).toEqual([{ work_item_id: "i1", task_id: "t1" }]));
    expect(events[1]).toEqual({ name: "inbox.arrival_undone", dims: { reverted: true } });
  });

  it("offers no Undo on an arrival still in the inbox", () => {
    renderStrip([item({ id: "i2" })]);
    expect(screen.getByText("In your inbox")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("pages past eight with Show all", async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      item({ id: `i${i}`, captured_at: new Date(Date.now() - i * 60_000).toISOString() }),
    );
    renderStrip(many);
    expect(screen.getAllByTestId("arrival-row")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Show all (10)" }));
    expect(screen.getAllByTestId("arrival-row")).toHaveLength(10);
  });
});
