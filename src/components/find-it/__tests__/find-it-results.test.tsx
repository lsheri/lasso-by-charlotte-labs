// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FindItResults, type FindItCandidate } from "@/components/find-it/FindItResults";
import type { WorkItemRow } from "@/lib/work-types";

vi.mock("@/components/work/SourceMark", () => ({
  SourceMark: () => <span data-testid="source-logo" />,
}));
vi.mock("@/components/work/WorkNote", () => ({
  WorkNote: ({ item }: { item: WorkItemRow }) => <div>{item.title}</div>,
}));

function item(id: string, title: string): WorkItemRow {
  return {
    id,
    title,
    type: "ai_thread",
    source: "paste",
    visibility: "private",
    captured_at: "2026-09-16T00:00:00.000Z",
    content_ref: null,
    work_item_tasks: [],
  };
}

function candidates(): FindItCandidate[] {
  return Array.from({ length: 12 }, (_, index) => {
    const relation = index < 4 ? "informed" : index < 8 ? "cited" : "produced";
    return {
      item: item(`item-${index}`, `Northwind source ${index + 1}`),
      link: {
        link_id: `link-${index}`,
        from_item_id: `item-${index}`,
        relation,
        status: "draft",
        rationale: "It contains the same pricing decision.",
        quote: { text: `Northwind shared sentence ${index + 1}`, turn_no: 1, role: "assistant" },
      },
    };
  });
}

describe("Find it results mode", () => {
  it("keeps reading nodes inside the same canvas", () => {
    render(
      <FindItResults
        phase="reading"
        target={{ ...item("target", "Northwind deck"), type: "deck" }}
        scope="engagement"
        candidates={candidates()}
        reviewed={{}}
        considered={12}
        reduceMotion={false}
        onChooseTarget={vi.fn()}
        onReturnToForm={vi.fn()}
        onReview={vi.fn()}
        onKeepAll={vi.fn()}
        onDone={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );

    expect(screen.getByTestId("find-it-canvas").getAttribute("data-phase")).toBe("reading");
    expect(screen.getAllByTestId("find-it-node")).toHaveLength(12);
    expect(screen.getByTestId("find-it-reading-nodes")).toBeTruthy();
    expect(screen.getAllByTestId("find-it-target")).toHaveLength(1);
  });

  it("settles into groups, shows one rail, and advances after Keep", () => {
    const review = vi.fn();
    render(
      <FindItResults
        phase="settled"
        target={{ ...item("target", "Northwind deck"), type: "deck" }}
        scope="engagement"
        candidates={candidates()}
        reviewed={{}}
        considered={12}
        reduceMotion={false}
        onChooseTarget={vi.fn()}
        onReturnToForm={vi.fn()}
        onReview={review}
        onKeepAll={vi.fn()}
        onDone={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("find-it-target")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "INFORMED 4" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "CITED 4" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "PRODUCED 4" })).toBeTruthy();
    expect(screen.getAllByTestId("find-it-detail")).toHaveLength(1);
    expect(screen.getByTestId("find-it-detail").textContent).toContain("Northwind source 1");

    fireEvent.click(screen.getByRole("button", { name: "Keep as a source" }));

    expect(review).toHaveBeenCalledWith("link-0", "confirmed");
    expect(screen.getByTestId("find-it-detail").textContent).toContain("Northwind source 2");
  });

  it("keeps every node attached after Done without a detail rail", () => {
    render(
      <FindItResults
        phase="kept"
        target={{ ...item("target", "Northwind deck"), type: "deck" }}
        scope="engagement"
        candidates={candidates()}
        reviewed={{}}
        considered={12}
        reduceMotion={false}
        onChooseTarget={vi.fn()}
        onReturnToForm={vi.fn()}
        onReview={vi.fn()}
        onKeepAll={vi.fn()}
        onDone={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );

    expect(screen.getByTestId("find-it-canvas").getAttribute("data-phase")).toBe("kept");
    expect(screen.getAllByTestId("find-it-node")).toHaveLength(12);
    expect(screen.queryByTestId("find-it-detail")).toBeNull();
  });
});