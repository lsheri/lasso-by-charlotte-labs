// @vitest-environment jsdom
import type React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ on: true }));
vi.mock("@/lib/feature-flags", () => ({ flagEnabled: (name: string) => (name === "ask-v2" ? flag.on : false) }));
const logEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ logEvent }));
vi.mock("@/components/rich-text/RichTextEditor", () => ({
  default: ({ initialHtml, onChange, onDone }: { initialHtml: string; onChange: (h: string, p: string) => void; onDone: () => void }) => (
    <div>
      <div role="toolbar">tools</div>
      <textarea aria-label="editor" defaultValue={initialHtml} onChange={(e) => onChange(`<p>${e.target.value}</p>`, e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") onDone(); }} />
    </div>
  ),
}));

import { clickStartsTyping, PIN_EDIT_COPY as EDIT_COPY, LabAnswerCard, PIN_DRAG_THRESHOLD_PX } from "@/components/canvas-lab/LabAnswerCard";
import { PIN_TIP_COPY, PIN_TIP_KEY, resetPinTip } from "@/components/canvas-lab/PinEditTip";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

const node = { id: "n1", kind: "answer", title: "Answer", summary: "The answer text", x: 0, y: 0, width: 280, height: 160, ownership: "yours", chatSessionId: "s1" } as unknown as LabNode;
const props = (over: Partial<React.ComponentProps<typeof LabAnswerCard>> = {}) => ({ node, focused: true, stackZ: 1, onFocus: vi.fn(), onPointerDown: vi.fn(), onDelete: vi.fn(), orgId: "org", onCommit: vi.fn(async () => null), ...over });

function clickText(dx = 0) {
  const body = screen.getByTestId("canvas-lab-answer-card").querySelector(".canvas-lab-answer-body")!;
  fireEvent.pointerDown(body, { clientX: 10, clientY: 10 });
  fireEvent.pointerUp(body, { clientX: 10 + dx, clientY: 10 });
}

beforeEach(() => { flag.on = true; resetPinTip(); window.localStorage.setItem(PIN_TIP_KEY, "1"); window.history.replaceState(null, "", "/?ask=b"); });
afterEach(() => { cleanup(); logEvent.mockReset(); window.localStorage.clear(); });

describe("PIN-1 P3 select vs type vs drag", () => {
  it("the rule: only a still click on the text of an already-selected card you own", () => {
    const base = { canEdit: true, editing: false, wasFocused: true, moved: 0, onControl: false };
    expect(clickStartsTyping(base)).toBe(true);
    expect(clickStartsTyping({ ...base, wasFocused: false })).toBe(false); // first click selects
    expect(clickStartsTyping({ ...base, moved: PIN_DRAG_THRESHOLD_PX })).toBe(false); // 4px is a drag
    expect(clickStartsTyping({ ...base, moved: PIN_DRAG_THRESHOLD_PX - 0.5 })).toBe(true);
    expect(clickStartsTyping({ ...base, onControl: true })).toBe(false);
    expect(clickStartsTyping({ ...base, canEdit: false })).toBe(false);
  });
  it("a first click on an unselected card selects and does not type", () => {
    render(<LabAnswerCard {...props({ focused: false })} />);
    clickText();
    expect(screen.queryByTestId("answer-editing-label")).toBeNull();
  });
  it("a click on the text of the selected card types; a 4px press stays a drag", async () => {
    const { rerender } = render(<LabAnswerCard {...props()} />);
    clickText(PIN_DRAG_THRESHOLD_PX);
    expect(screen.queryByTestId("answer-editing-label")).toBeNull();
    rerender(<LabAnswerCard {...props()} />);
    clickText(0);
    expect(screen.getByTestId("answer-editing-label").textContent).toBe(EDIT_COPY.editing);
    expect(screen.getByTestId("canvas-lab-answer-card").getAttribute("data-editing")).toBe("true");
  });
  it("while editing: tools inside the card, Done and Cancel, the menu and chat row step aside", async () => {
    render(<LabAnswerCard {...props()} />);
    clickText();
    const card = screen.getByTestId("canvas-lab-answer-card");
    expect(await screen.findByRole("toolbar")).toBeTruthy();
    expect(card.getAttribute("data-v2")).toBe("true");
    expect(screen.getByRole("button", { name: EDIT_COPY.done })).toBeTruthy();
    expect(screen.getByRole("button", { name: EDIT_COPY.cancel })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Answer menu" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Chat/ })).toBeNull();
  });
  it("Cancel keeps the answer unchanged and saves nothing", async () => {
    const onCommit = vi.fn(async () => null);
    render(<LabAnswerCard {...props({ onCommit })} />);
    clickText();
    fireEvent.change(await screen.findByLabelText("editor"), { target: { value: "rewritten" } });
    fireEvent.click(screen.getByRole("button", { name: EDIT_COPY.cancel }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByTestId("answer-editing-label")).toBeNull();
  });
  it("Done saves the edit and keeps the original", async () => {
    const onCommit = vi.fn(async (_: string) => null);
    render(<LabAnswerCard {...props({ onCommit })} />);
    clickText();
    fireEvent.change(await screen.findByLabelText("editor"), { target: { value: "rewritten" } });
    fireEvent.click(screen.getByRole("button", { name: EDIT_COPY.done }));
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
    const body = JSON.parse(onCommit.mock.calls[0]![0]) as { original?: string; text?: string };
    expect(body.original).toBe("The answer text");
    expect(body.text).toBe("rewritten");
    // Event names unchanged.
    expect(logEvent.mock.calls.map(([name]) => name)).toEqual(["workboard.node_edited", "answer.edited"]);
  });
});

describe("PIN-1 Esc stops at the card", () => {
  it("Escape while editing never reaches the board", async () => {
    const board = vi.fn();
    window.addEventListener("keydown", board);
    render(<LabAnswerCard {...props()} />);
    clickText();
    const editor = await screen.findByLabelText("editor");
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(board).not.toHaveBeenCalled();
    window.removeEventListener("keydown", board);
  });
});

describe("PIN-1 teammates", () => {
  it("a non-owner never edits and sees View only", () => {
    const onCommit = vi.fn(async () => null);
    render(<LabAnswerCard {...props({ node: { ...node, ownership: "theirs" } as unknown as LabNode, onCommit })} />);
    expect(screen.getByTestId("answer-view-only").textContent).toBe(EDIT_COPY.viewOnly);
    clickText();
    fireEvent.doubleClick(screen.getByTestId("canvas-lab-answer-card").querySelector(".canvas-lab-answer-body")!);
    expect(screen.queryByTestId("answer-editing-label")).toBeNull();
    expect(screen.getByTestId("canvas-lab-answer-card").getAttribute("data-editing")).toBeNull();
  });
});

describe("PIN-1 P4 one-time tip", () => {
  it("shows once on the first pinned answer, never again after Got it", async () => {
    window.localStorage.removeItem(PIN_TIP_KEY);
    render(<LabAnswerCard {...props()} />);
    expect((await screen.findByTestId("pin-edit-tip")).textContent).toContain(PIN_TIP_COPY.text);
    fireEvent.click(screen.getByRole("button", { name: PIN_TIP_COPY.ok }));
    expect(screen.queryByTestId("pin-edit-tip")).toBeNull();
    expect(window.localStorage.getItem(PIN_TIP_KEY)).toBe("1");
    cleanup();
    render(<LabAnswerCard {...props()} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.queryByTestId("pin-edit-tip")).toBeNull();
  });
  it("only one card shows it at a time", async () => {
    window.localStorage.removeItem(PIN_TIP_KEY);
    render(<><LabAnswerCard {...props()} /><LabAnswerCard {...props({ node: { ...node, id: "n2", chatSessionId: "s2" } as unknown as LabNode })} /></>);
    await screen.findAllByTestId("pin-edit-tip");
    expect(screen.getAllByTestId("pin-edit-tip")).toHaveLength(1);
  });
});

describe("PIN-1 copy", () => {
  it("plain words, no em dash, no watching words", () => {
    expect(Object.values(EDIT_COPY).join(" ")).not.toMatch(/—|\b(score|monitor|track|surveillance|analytics)\b/i);
    expect(PIN_TIP_COPY.text).not.toMatch(/—/);
  });
});

// FLAGS-1 (10 Nov): the flag-off card is retired; every user has the PIN-1 edit.

