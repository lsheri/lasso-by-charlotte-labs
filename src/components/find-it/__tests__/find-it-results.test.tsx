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
  it("renders one target, grouped counts, one detail rail, and advances after Keep", () => {
    const review = vi.fn();
    render(
      <FindItResults
        target={{ ...item("target", "Northwind deck"), type: "deck" }}
        scope="engagement"
        candidates={candidates()}
        reviewed={{}}
        onChooseAgain={vi.fn()}
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
});