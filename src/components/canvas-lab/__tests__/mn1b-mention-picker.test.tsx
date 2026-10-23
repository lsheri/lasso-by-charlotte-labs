// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MentionPicker } from "@/components/canvas-lab/MentionPicker";
import { CommentComposer } from "@/components/canvas-lab/FocusOverlay";
import { LabSticky } from "@/components/canvas-lab/LabSticky";
import { committedComment, insertMention, mentionTrigger, mentionsAfterEdit, stickyMentionCandidates } from "@/lib/mention-editor";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const candidates = [{ profileId: "ben", displayName: "Ben Stanton" }, { profileId: "ana", displayName: "Ana Perez" }];
afterEach(cleanup);

describe("MENTION-1b picker", () => {
  it("filters display names without case sensitivity", () => {
    render(<MentionPicker candidates={candidates} query="STANT" onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option").textContent).toBe("Ben Stanton");
  });
  it("supports arrows, Home, End, Enter and Escape with a real active descendant", () => {
    const pick = vi.fn(); const close = vi.fn();
    render(<MentionPicker candidates={candidates} query="" onPick={pick} onClose={close} />);
    const list = screen.getByRole("listbox");
    const active = () => document.getElementById(list.getAttribute("aria-activedescendant") ?? "")?.textContent;
    expect(active()).toBe("Ben Stanton");
    fireEvent.keyDown(list, { key: "ArrowDown" }); expect(active()).toBe("Ana Perez");
    fireEvent.keyDown(list, { key: "ArrowUp" }); expect(active()).toBe("Ben Stanton");
    fireEvent.keyDown(list, { key: "End" }); expect(active()).toBe("Ana Perez");
    fireEvent.keyDown(list, { key: "Home" }); expect(active()).toBe("Ben Stanton");
    fireEvent.keyDown(list, { key: "Enter" }); expect(pick).toHaveBeenCalledWith(candidates[0]);
    fireEvent.keyDown(list, { key: "Escape" }); expect(close).toHaveBeenCalledOnce();
  });
  it("click selects and an empty list cannot select", () => {
    const pick = vi.fn();
    const view = render(<MentionPicker candidates={candidates} query="ana" onPick={pick} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("option")); expect(pick).toHaveBeenCalledWith(candidates[1]);
    view.rerender(<MentionPicker candidates={candidates} query="nobody" onPick={pick} onClose={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Enter" });
    expect(screen.queryAllByRole("option")).toHaveLength(0); expect(pick).toHaveBeenCalledOnce();
  });
  it("comment keyboard selection inserts ordinary text and submits matching offsets", () => {
    const submit = vi.fn();
    render(<CommentComposer label="Comment words" placeholder="Write here" submitLabel="Post" mentionCandidates={candidates} onSubmit={submit} onCancel={vi.fn()} />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Ask @be", selectionStart: 7 } });
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("Ask @Ben Stanton "); expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(submit).toHaveBeenCalledWith("Ask @Ben Stanton", [{ profileId: "ben", label: "Ben Stanton", start: 4, length: 12 }]);
    expect(input.hasAttribute("contenteditable")).toBe(false);
  });
  it("sticky click selection commits plain text plus mentions", () => {
    const commit = vi.fn(); const noop = vi.fn();
    render(<LabSticky node={{ id: "s", kind: "sticky", title: "Sticky", summary: "", typeLabel: "sticky", ownership: "yours", local: true, x: 0, y: 0, width: 260, height: 160 }} selected editable layoutEditable mentionCandidates={candidates} onSelect={noop} onDragStart={noop} onResizeStart={noop} onResizeKeyDown={noop} onResizeKeyUp={noop} onChange={noop} onCommit={commit} onRemove={noop} />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "@ana", selectionStart: 4 } });
    fireEvent.click(screen.getByRole("option"));
    fireEvent.keyDown(input, { key: "Escape" });
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0]?.[0]).toMatchObject({ text: "@Ana Perez ", mentions: [{ profileId: "ana", label: "Ana Perez", start: 0, length: 10 }] });
    expect(commit.mock.calls[0]?.[0].html).toBeUndefined();
  });
  it("drops an edited mention, shifts untouched mentions, and trims offsets", () => {
    const mention = { profileId: "ben", label: "Ben", start: 4, length: 4 };
    expect(mentionsAfterEdit("Ask @Ben", "Ask ", [mention])).toEqual([]);
    expect(mentionsAfterEdit("Ask @Ben", "Please ask @Ben", [mention])).toEqual([{ ...mention, start: 11 }]);
    expect(committedComment("  @Ben  ", [{ ...mention, start: 2 }])).toEqual({ body: "@Ben", mentions: [{ ...mention, start: 0 }] });
  });
  it("finds the caret run and inserts there rather than at the end", () => {
    const trigger = mentionTrigger("Ask @be today", 7);
    expect(trigger).toEqual({ start: 4, end: 7, query: "be" });
    expect(insertMention("Ask @be today", [], { start: 4, end: 7, query: "be" }, candidates[0] ?? { profileId: "", displayName: "" }).text).toBe("Ask @Ben Stanton  today");
    expect(mentionTrigger("email@example.com", 17)).toBeNull();
  });
});

describe("MENTION-FIX-1", () => {
  const sticky = { id: "s", kind: "sticky" as const, title: "Sticky", summary: "", typeLabel: "sticky", ownership: "yours" as const, local: true, x: 0, y: 0, width: 260, height: 160 };
  it("without candidates the sticky uses the rich editor, not the plain textarea", () => {
    const noop = vi.fn();
    render(<LabSticky node={sticky} selected editable layoutEditable mentionCandidates={undefined} onSelect={noop} onDragStart={noop} onResizeStart={noop} onResizeKeyDown={noop} onResizeKeyUp={noop} onChange={noop} onCommit={noop} onRemove={noop} />);
    expect(screen.getByTestId("sticky-s").getAttribute("data-editing")).toBe("true");
    expect(screen.queryByRole("textbox", { name: "Sticky words" })).toBeNull();
    expect(document.querySelector("textarea")).toBeNull();
  });
  it("the page gate passes undefined for missing or empty candidate lists", () => {
    expect(stickyMentionCandidates(undefined)).toBeUndefined();
    expect(stickyMentionCandidates([])).toBeUndefined();
    expect(stickyMentionCandidates(candidates)).toBe(candidates);
  });
  it("a space after @ closes the run", () => {
    expect(mentionTrigger("meet @ 5pm", 10)).toBeNull();
    expect(mentionTrigger("Ask @be", 7)).toEqual({ start: 4, end: 7, query: "be" });
  });
  it("Escape dismissal sticks to the run while typing continues", () => {
    render(<CommentComposer label="Comment words" placeholder="Write here" submitLabel="Post" mentionCandidates={candidates} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Ask @b", selectionStart: 6 } });
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.change(input, { target: { value: "Ask @be", selectionStart: 7 } });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("Enter with no matches reaches the composer submit", () => {
    const submit = vi.fn();
    render(<CommentComposer label="Comment words" placeholder="Write here" submitLabel="Post" mentionCandidates={candidates} onSubmit={submit} onCancel={vi.fn()} />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Ask @zz", selectionStart: 7 } });
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(submit).toHaveBeenCalledWith("Ask @zz", []);
  });
});
