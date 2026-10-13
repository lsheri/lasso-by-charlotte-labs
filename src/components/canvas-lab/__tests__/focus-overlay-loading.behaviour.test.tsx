// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-work-file-download", () => ({ useWorkFileDownload: () => vi.fn() }));
vi.mock("@/components/peek/ThreadBody", () => ({ ThreadBody: () => <p>Stored conversation</p> }));

import { COPY, FocusOverlay } from "@/components/canvas-lab/FocusOverlay";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import type { WorkItemRow } from "@/lib/work-types";

const node = {
  id: "card", kind: "ai_work", title: "A conversation", typeLabel: "AI work",
  summary: "Saved summary", prompt: "Saved prompt", ownership: "yours",
  x: 0, y: 0, width: 320, height: 200,
} as LabNode;
const item = {
  id: "thread", title: "A conversation", type: "ai_thread", source: "paste",
  visibility: "private", captured_at: "2026-10-13T00:00:00Z",
  content_ref: null, created_at_source: null, work_date: null, work_item_tasks: [],
} as WorkItemRow;

function overlay(itemLoading: boolean, resolved: WorkItemRow | null = null) {
  return <FocusOverlay node={node} item={resolved} itemLoading={itemLoading}
    onSummarize={() => undefined} onBranch={() => undefined} onClose={() => undefined} />;
}

afterEach(cleanup);

describe("focus reader pending and unavailable work", () => {
  it("shows loading rather than failure while the item read is pending", () => {
    render(overlay(true));
    expect(screen.getByRole("status", { name: "Working" })).toBeTruthy();
    expect(screen.getByText("Loading work…")).toBeTruthy();
    expect(screen.queryByText(COPY.unavailable)).toBeNull();
    expect(screen.queryByText("No turns stored for this item.")).toBeNull();
  });

  it("shows true failure copy and preserves summary and prompt when not pending", () => {
    render(overlay(false));
    expect(screen.getByText("This card's work could not be loaded. Please try again.")).toBeTruthy();
    expect(screen.getByText(node.summary)).toBeTruthy();
    expect(screen.getByText(node.prompt ?? "")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Working" })).toBeNull();
    expect(screen.queryByText(COPY.loading)).toBeNull();
    expect(screen.queryByText(/the live AI connection is off in this prototype/i)).toBeNull();
  });

  it("renders a resolved conversation with neither pending nor failure treatment", () => {
    render(overlay(true, item));
    expect(screen.getByText("Stored conversation")).toBeTruthy();
    expect(screen.queryByText(COPY.loading)).toBeNull();
    expect(screen.queryByText(COPY.unavailable)).toBeNull();
    expect(screen.queryByRole("status", { name: "Working" })).toBeNull();
  });

  it("moves from pending to unavailable, and then to a resolved item", () => {
    const { rerender } = render(overlay(true));
    rerender(overlay(false));
    expect(screen.getByText(COPY.unavailable)).toBeTruthy();
    expect(screen.queryByText(COPY.loading)).toBeNull();
    rerender(overlay(false, item));
    expect(screen.getByText("Stored conversation")).toBeTruthy();
    expect(screen.queryByText(COPY.unavailable)).toBeNull();
  });

  it("pins honest copy without em dashes or claims of emptiness", () => {
    expect(COPY).toEqual({
      loading: "Loading work…",
      unavailable: "This card's work could not be loaded. Please try again.",
    });
    for (const value of Object.values(COPY)) {
      expect(value).not.toMatch(/—|\b(?:empty|nothing|none|no turns|no work)\b/i);
    }
  });
});