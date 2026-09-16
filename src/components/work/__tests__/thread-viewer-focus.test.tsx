// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const turns = [
  { id: "t1", turn_no: 1, role: "user", content: "Start at the top.", ts: null, model: null, meta: null },
  { id: "t2", turn_no: 2, role: "assistant", content: "The exact sentence lives here for the record.", ts: null, model: null, meta: null },
];

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: turns, error: null }),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { ThreadBody, focusedTextRange } = await import("@/components/peek/ThreadBody");

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

describe("conversation evidence focus", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(cleanup);

  it("matches a known sentence while tolerating whitespace", () => {
    expect(focusedTextRange("One\n exact   sentence here", "exact sentence")).toEqual([5, 21]);
  });

  it("circles the exact sentence and scrolls to its turn", () => {
    render(<ThreadBody item={item} focus={{ turnNo: 2, text: "exact sentence lives here" }} reducedMotion />);
    expect(screen.getByTestId("focused-evidence-text").textContent).toBe("exact sentence lives here");
    expect(screen.getByTestId("evidence-circle")).toBeTruthy();
    expect(screen.getByText("this is the turn it came from")).toBeTruthy();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });

  it("circles the whole bubble when only a turn is known", () => {
    render(<ThreadBody item={item} focus={{ turnNo: 1 }} reducedMotion />);
    expect(screen.getByTestId("evidence-circle")).toBeTruthy();
  });

  it("opens at the top without a mark when the turn is unavailable", () => {
    render(<ThreadBody item={item} focus={{ turnNo: 99, text: "not present" }} reducedMotion />);
    expect(screen.queryByTestId("evidence-circle")).toBeNull();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});