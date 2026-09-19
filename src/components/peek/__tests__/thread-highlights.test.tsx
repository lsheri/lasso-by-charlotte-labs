// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const turns = [
  { id: "t1", turn_no: 1, role: "user", content: "Start at the top.", content_hash: "h1", ts: null, model: null, meta: null },
  {
    id: "t2",
    turn_no: 2,
    role: "assistant",
    content: "The pricing floor is 40 percent and the discount stops there.",
    content_hash: "h2",
    ts: null,
    model: null,
    meta: null,
  },
];

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: turns, error: null }),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { ThreadBody } = await import("@/components/peek/ThreadBody");

const item = {
  id: "thread-1",
  title: "A conversation",
  type: "ai_thread",
  source: "paste",
  visibility: "private",
  captured_at: "2026-09-16T00:00:00Z",
  content_ref: null,
  created_at_source: null,
  work_date: null,
  work_item_tasks: [],
} as never;

describe("highlights drawn on chat turns", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(cleanup);

  it("draws several ranges on one turn and merges the overlapping pair", () => {
    render(
      <ThreadBody
        item={item}
        reducedMotion
        highlights={[
          { id: "a", turnNo: 2, charStart: 4, charEnd: 17, stale: false },
          { id: "b", turnNo: 2, charStart: 12, charEnd: 24, stale: false },
          { id: "c", turnNo: 2, charStart: 42, charEnd: 50, stale: false },
        ]}
      />,
    );
    const marks = screen.getAllByTestId("turn-highlight");
    expect(marks).toHaveLength(2);
    expect(marks[0]?.textContent).toBe("pricing floor is 40");
    expect(marks[1]?.textContent).toBe("discount");
  });

  it("does not draw a highlight whose turn has moved on", () => {
    render(
      <ThreadBody
        item={item}
        reducedMotion
        highlights={[{ id: "a", turnNo: 2, charStart: 4, charEnd: 17, stale: true }]}
      />,
    );
    expect(screen.queryByTestId("turn-highlight")).toBeNull();
  });

  it("leaves a turn with no highlights untouched", () => {
    render(<ThreadBody item={item} reducedMotion highlights={[]} />);
    expect(screen.queryByTestId("turn-highlight")).toBeNull();
    expect(screen.getByText("Start at the top.")).toBeTruthy();
  });
});
