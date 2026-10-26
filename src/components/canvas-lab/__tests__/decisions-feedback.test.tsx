// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ link: vi.fn() }));
vi.mock("@/lib/decisions.functions", () => ({ linkPassageToDecision: h.link }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/work-files.functions", () => ({ getVersionFileUrl: vi.fn() }));
vi.mock("../canvas-lab-telemetry", () => ({ noteWorkboardLedgerOpened: vi.fn() }));
import { DecisionFeedbackPicker, feedbackItems } from "../DecisionsLedger";
import { DecisionsMemo, memoText } from "../DecisionsMemo";
import type { WorkItemRow } from "@/lib/work-types";
const item = (id: string, type: WorkItemRow["type"], doc_kind?: string) => ({ id, type, title: id, doc_kind, content_ref: null, captured_at: "2026-10-26", source: "upload", visibility: "unmapped", work_item_tasks: [] }) as WorkItemRow;
afterEach(() => { cleanup(); h.link.mockReset(); });
describe("Ledger feedback", () => {
  it("lists calls separately and excludes decisions and unrelated types", () => {
    const grouped = feedbackItems([item("file", "document"), item("call", "call"), item("doc", "document", "decisions"), item("other-decision", "document", "decisions"), item("chat", "ai_thread")], "doc");
    expect(grouped.calls.map((row) => row.id)).toEqual(["call"]);
    expect(grouped.files.map((row) => row.id)).toEqual(["file"]);
  });
  it("sends a typed passage and optional timestamp then confirms success", async () => {
    h.link.mockResolvedValue({ id: "span" }); const linked = vi.fn();
    render(<DecisionFeedbackPicker documentId="doc" decisionId="line" items={[item("call", "call")]} onClose={vi.fn()} onLinked={linked} />);
    fireEvent.change(screen.getByLabelText("Choose a transcript"), { target: { value: "call" } });
    fireEvent.change(screen.getByLabelText("Passage"), { target: { value: "Alice: Proceed" } });
    fireEvent.change(screen.getByLabelText("Timestamp (optional)"), { target: { value: "00:14:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Link to a decision" }));
    await waitFor(() => expect(linked).toHaveBeenCalledOnce());
    expect(h.link).toHaveBeenCalledWith({ data: { document_id: "doc", id: "line", transcript_id: "call", quote: "Alice: Proceed", to_locator: { char_start: 0, char_end: 14, at: "00:14:30" } } });
  });
  it("memo and copied text disclose presence only, never private passage fields", () => {
    const lines = [{ id: "line", ord: 1, statement: "Proceed", reason: null, status: "open" as const, has_source: false, has_feedback: true, quote: "Private words", transcript_title: "Private call", at: "00:14:30" }];
    render(<DecisionsMemo title="Decisions" date={undefined} lines={lines} />);
    expect(screen.getByText("feedback from a call, kept on the board")).toBeTruthy();
    expect(screen.queryByText("Private words")).toBeNull();
    const text = memoText("Decisions", undefined, lines);
    expect(text).toContain("feedback from a call, kept on the board");
    expect(text).not.toMatch(/Private words|Private call|00:14:30/);
  });
});
