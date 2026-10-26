// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const turns = [
  { id: "t1", turn_no: 1, role: "user", content: "Start at the top.", ts: null, model: null, meta: null },
  { id: "t2", turn_no: 2, role: "assistant", content: "The exact sentence lives here for the record.", ts: null, model: null, meta: null },
];

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: turns, error: null }),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/components/decisions/DraftDecisionsButton", () => ({ DraftDecisionsButton: () => null }));
vi.mock("@/components/work/ChatUrlLink", () => ({ ChatUrlLink: () => null }));
vi.mock("@/components/work/SourceMark", () => ({ ArtifactNote: () => null, SourceMark: () => null }));
vi.mock("@/components/work/TypeIcon", () => ({ TypeChip: () => null }));

const { ThreadBody, focusedTextRange } = await import("@/components/peek/ThreadBody");
const { ThreadViewer } = await import("@/components/work/ThreadViewer");

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
  it("Back is inside the modal and calls only onBack", () => {
    const onBack = vi.fn(); const onOpenChange = vi.fn();
    render(<ThreadViewer item={item} open onOpenChange={onOpenChange} onBack={onBack} />);
    const back = screen.getByRole("button", { name: "Back to the decisions" });
    expect(screen.getByRole("dialog").contains(back)).toBe(true);
    fireEvent.click(back); expect(onBack).toHaveBeenCalledTimes(1); expect(onOpenChange).not.toHaveBeenCalled();
  });
  it("Escape returns through onBack when supplied", async () => {
    const onBack = vi.fn(); const onOpenChange = vi.fn();
    render(<ThreadViewer item={item} open onOpenChange={onOpenChange} onBack={onBack} backLabel="Back" />);
    await waitFor(() => expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
    expect(onBack).toHaveBeenCalledTimes(1); expect(onOpenChange).not.toHaveBeenCalled();
  });
  it("without onBack there is no Back control and Escape keeps the existing close path", async () => {
    const onOpenChange = vi.fn();
    render(<ThreadViewer item={item} open onOpenChange={onOpenChange} />);
    expect(screen.queryByRole("button", { name: "Back to the decisions" })).toBeNull();
    await waitFor(() => expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});