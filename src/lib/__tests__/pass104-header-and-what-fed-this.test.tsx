import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkItemRow } from "@/lib/work-types";

const opened = vi.fn();
const confirmRequests: unknown[] = [];

vi.mock("@/components/provenance/audit-state", () => ({
  openProvenanceAudit: (request: unknown) => opened(request),
}));

vi.mock("@/components/reflect/AnalysisConfirm", () => ({
  AnalysisConfirm: ({
    request,
    onConfirm,
  }: {
    request: { target: { id: string } } | null;
    onConfirm: (anchorItemId: string | null, extraItemIds: string[]) => void;
  }) => {
    if (!request) return null;
    confirmRequests.push(request);
    return (
      <button type="button" onClick={() => onConfirm(request.target.id, [])}>
        confirm-run
      </button>
    );
  },
}));

const { WhatFedThisButton, WHAT_FED_THIS_EMPTY_HINT, WHAT_FED_THIS_INFO, latestDeliverable } =
  await import("@/components/engagements/WhatFedThisButton");

function item(id: string, type: string, date: string): WorkItemRow {
  return {
    id,
    title: `${type} ${id}`,
    type,
    source: "upload",
    visibility: "mapped",
    captured_at: date,
    content_ref: null,
    created_at_source: null,
    work_date: date,
    work_item_tasks: [],
  } as unknown as WorkItemRow;
}

function renderButton(items: WorkItemRow[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WhatFedThisButton items={items} orgId="org" profileId="me" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  opened.mockClear();
  confirmRequests.length = 0;
});

describe("pass 104 · brief panel above coaching", () => {
  const page = readFileSync("src/pages/EngagementPage.tsx", "utf8");
  const panel = readFileSync("src/components/engagements/EngagementBriefPanel.tsx", "utf8");

  it("renders the brief as a bordered form panel above the coaching sticky", () => {
    const brief = page.indexOf("<EngagementBriefPanel");
    const coaching = page.indexOf('title="Coaching and sharing"');
    expect(brief).toBeGreaterThan(-1);
    expect(coaching).toBeGreaterThan(brief);
    expect(panel).toContain("border border-border bg-card");
    expect(panel).not.toContain("EngagementNote");
    expect(panel).toContain("No brief yet");
    expect(panel).toContain("EngagementBriefSection");
  });

  it("drops the paired open state and the blue sticky plumbing", () => {
    expect(page).not.toContain("setNotesOpen");
    expect(page).not.toContain('tone="blue"');
    expect(readFileSync("src/styles.css", "utf8")).not.toContain("--nb-sticky-blue");
  });
});

describe("pass 104 · graphite title rule", () => {
  it("lives in marks.tsx and is consumed by the title strip", () => {
    const marks = readFileSync("src/components/notebook/marks.tsx", "utf8");
    expect(marks).toContain("export function GraphiteRule");
    expect(marks).toContain('preserveAspectRatio="none"');
    const page = readFileSync("src/pages/EngagementPage.tsx", "utf8");
    expect(page).toContain("nb-title-strip");
    expect(page).toContain("<GraphiteRule />");
    const styles = readFileSync("src/styles.css", "utf8");
    expect(styles).toContain("padding-bottom: 12px");
    expect(styles).toContain(".nb-title-rule");
    expect(styles).not.toContain("repeating-linear-gradient(\n    to bottom,\n    transparent 0,\n    transparent calc(var(--nb-baseline) - 1px),\n    var(--nb-rule)");
  });
});

describe("pass 104 · what fed this on the canvas", () => {
  it("stays muted with no deliverable and names why", () => {
    renderButton([item("t1", "thread", "2026-01-01")]);
    const button = screen.getByRole("button", { name: "What fed this" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("title")).toBe(WHAT_FED_THIS_EMPTY_HINT);
  });

  it("strengthens once a deliverable exists and runs the shared confirm", () => {
    renderButton([item("t1", "thread", "2026-01-01"), item("d1", "deck", "2026-02-01")]);
    const button = screen.getByRole("button", { name: "What fed this" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.className).toContain("border-accent");
    fireEvent.click(button);
    expect(confirmRequests).toHaveLength(1);
    fireEvent.click(screen.getByText("confirm-run"));
    expect(opened).toHaveBeenCalledWith(expect.objectContaining({ anchorId: "d1" }));
  });

  it("anchors on the most recent deliverable", () => {
    const chosen = latestDeliverable([
      item("old", "document", "2026-01-01"),
      item("new", "deck", "2026-03-01"),
      item("thread", "thread", "2026-04-01"),
    ]);
    expect(chosen?.id).toBe("new");
  });

  it("explains itself in one line", () => {
    renderButton([item("d1", "deck", "2026-02-01")]);
    fireEvent.click(screen.getByRole("button", { name: "How this works" }));
    expect(screen.getByText(WHAT_FED_THIS_INFO)).toBeTruthy();
  });

  it("is hidden from coaches on the engagement page", () => {
    const page = readFileSync("src/pages/EngagementPage.tsx", "utf8");
    const marker = page.indexOf("<WhatFedThisButton");
    const guard = page.lastIndexOf('profile.role !== "coach"', marker);
    expect(guard).toBeGreaterThan(-1);
    expect(marker - guard).toBeLessThan(400);
  });
});
