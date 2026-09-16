// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FindItResults, type FindItCandidate } from "@/components/find-it/FindItResults";
import type { WorkItemRow } from "@/lib/work-types";

vi.mock("@/components/work/SourceMark", () => ({
  SourceMark: () => <span data-testid="source-logo" />,
}));
vi.mock("@/components/work/WorkNote", () => ({
  WorkNote: ({ item }: { item: WorkItemRow }) => <div>{item.title}</div>,
}));

afterEach(cleanup);

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

function candidates(count = 16): FindItCandidate[] {
  return Array.from({ length: count }, (_, index) => {
    const relation = index < 4 ? "informed" : index < 8 ? "cited" : "produced";
    const evidence = index % 3;
    return {
      item: item(`item-${index}`, `Northwind source ${index + 1}`),
      link: {
        link_id: `link-${index}`,
        from_item_id: `item-${index}`,
        relation,
        status: "draft",
        rationale: evidence === 0 ? "It contains the same pricing decision." : evidence === 1 ? "The Northwind deck names 2026 pricing." : "The reasoning is related.",
        quote: evidence === 0 ? { text: `Northwind shared sentence ${index + 1}`, turn_no: 1, role: "assistant" } : null,
      },
    };
  });
}

describe("Find it results mode", () => {
  it("uses unique seeded slots and at least three concurrent reading lines", () => {
    render(
      <FindItResults
        phase="reading"
        target={{ ...item("target", "Northwind deck"), type: "deck" }}
        scope="engagement"
        candidates={candidates()}
        reviewed={{}}
        considered={16}
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
    expect(screen.getAllByTestId("find-it-node")).toHaveLength(14);
    expect(screen.getByTestId("find-it-reading-nodes")).toBeTruthy();
    const slots = Array.from(screen.getByTestId("find-it-reading-nodes").children).map((node) => node.getAttribute("data-slot"));
    expect(new Set(slots).size).toBe(slots.length);
    expect(screen.getAllByTestId("find-it-tracing-line").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByTestId("find-it-target")).toHaveLength(1);
  });

  it("settles onto an arc with weighted arrows and advances the inline expansion", () => {
    const review = vi.fn();
    render(
      <FindItResults
        phase="settled"
        target={{ ...item("target", "Northwind deck"), type: "deck" }}
        scope="engagement"
        candidates={candidates()}
        reviewed={{}}
        considered={16}
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
    expect(screen.getByTestId("find-it-arc")).toBeTruthy();
    expect(screen.queryByText(/INFORMED ·/)).toBeNull();
    expect(screen.getAllByTestId("find-it-arrow").some((arrow) => arrow.getAttribute("data-strength") === "heavy")).toBe(true);
    expect(screen.getAllByTestId("find-it-arrow").some((arrow) => arrow.getAttribute("data-strength") === "normal")).toBe(true);
    expect(screen.getAllByTestId("find-it-arrow").some((arrow) => arrow.getAttribute("data-strength") === "light")).toBe(true);
    expect(screen.getAllByTestId("find-it-detail")).toHaveLength(1);
    expect(screen.getByTestId("find-it-detail").textContent).toContain("Northwind source 1");

    fireEvent.click(screen.getByRole("button", { name: "Keep as a source" }));

    expect(review).toHaveBeenCalledWith("link-0", "confirmed");
    expect(screen.getByTestId("find-it-detail").textContent).toContain("Northwind source 4");
  });

  it("orders cards by evidence and moves the next card by the expanded delta", () => {
    const { rerender } = render(
      <FindItResults phase="kept" target={{ ...item("target", "Northwind deck"), type: "deck" }} scope="engagement" candidates={candidates(6)} reviewed={Object.fromEntries(candidates(6).map(({ link }) => [link.link_id, "confirmed" as const]))} considered={6} reduceMotion={false} onChooseTarget={vi.fn()} onReturnToForm={vi.fn()} onReview={vi.fn()} onKeepAll={vi.fn()} onDone={vi.fn()} onOpenThread={vi.fn()} />,
    );
    const nodes = screen.getAllByTestId("find-it-arc-node");
    expect(nodes.map((node) => node.getAttribute("data-evidence"))).toEqual(["heavy", "heavy", "normal", "normal", "light", "light"]);
    const nextBefore = Number.parseFloat(nodes[1]?.style.getPropertyValue("--y") ?? "0");
    rerender(<FindItResults phase="settled" target={{ ...item("target", "Northwind deck"), type: "deck" }} scope="engagement" candidates={candidates(6)} reviewed={{}} considered={6} reduceMotion={false} onChooseTarget={vi.fn()} onReturnToForm={vi.fn()} onReview={vi.fn()} onKeepAll={vi.fn()} onDone={vi.fn()} onOpenThread={vi.fn()} />);
    const nextAfter = Number.parseFloat(screen.getAllByTestId("find-it-arc-node")[1]?.style.getPropertyValue("--y") ?? "0");
    expect(nextAfter).toBeGreaterThan(nextBefore);
  });

  it("interleaves twelve links across two non-overlapping arcs", () => {
    render(
      <FindItResults phase="settled" target={{ ...item("target", "Northwind deck"), type: "deck" }} scope="engagement" candidates={candidates(12)} reviewed={{}} considered={12} reduceMotion={false} onChooseTarget={vi.fn()} onReturnToForm={vi.fn()} onReview={vi.fn()} onKeepAll={vi.fn()} onDone={vi.fn()} onOpenThread={vi.fn()} />,
    );
    const nodes = screen.getAllByTestId("find-it-arc-node");
    const first = nodes.filter((node) => node.getAttribute("data-arc") === "0");
    const second = nodes.filter((node) => node.getAttribute("data-arc") === "1");
    expect(first).toHaveLength(6);
    expect(second).toHaveLength(6);
    const firstYs = first.map((node) => Number.parseFloat(node.style.getPropertyValue("--y")));
    const secondYs = second.map((node) => Number.parseFloat(node.style.getPropertyValue("--y")));
    expect(secondYs[0]).toBeGreaterThan(firstYs[0] ?? 0);
    expect(secondYs[0]).toBeLessThan(firstYs[1] ?? 100);
  });

  it("keeps every node attached after Done without a detail rail", () => {
    const reviewed = Object.fromEntries(candidates().map(({ link }) => [link.link_id, "confirmed" as const]));
    render(
      <FindItResults
        phase="kept"
        target={{ ...item("target", "Northwind deck"), type: "deck" }}
        scope="engagement"
        candidates={candidates()}
        reviewed={reviewed}
        considered={16}
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
    expect(screen.getAllByTestId("find-it-node")).toHaveLength(16);
    expect(screen.queryByTestId("find-it-detail")).toBeNull();
  });
});