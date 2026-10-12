// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { LabAnswerCard, answerChangeBand, EDIT_COPY } from "@/components/canvas-lab/LabAnswerCard";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { parseAnswerBody } from "@/lib/answer-card";
import { logEvent } from "@/lib/telemetry";
import { EVENT_DIM_KEYS, guardEventDims } from "@/lib/event-dim-allowlist";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }) });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const node: LabNode = { id: "answer", kind: "answer", title: "Answer", summary: "  Original answer\n", typeLabel: "Answer", ownership: "yours", local: true, authorName: "Liam", x: 0, y: 80, width: 320, height: 240 };
function mount(patch: Partial<LabNode> = {}, commit = vi.fn<(body: string) => Promise<string | null>>().mockResolvedValue(null)) {
  const props = { node: { ...node, ...patch }, orgId: "org", focused: false, stackZ: 1, onFocus: vi.fn(), onPointerDown: vi.fn(), onDelete: vi.fn(), onCommit: commit };
  const view = render(<LabAnswerCard {...props} />);
  return { ...view, props, commit };
}
async function edit() {
  fireEvent.doubleClick(screen.getByText("Original answer"));
  return screen.findByRole("textbox", { name: "Text" });
}
async function bold(box: HTMLElement) {
  box.focus();
  const range = document.createRange(); range.selectNodeContents(box.querySelector("p") ?? box);
  const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
  fireEvent.keyDown(box, { key: "b", code: "KeyB", ctrlKey: true });
  await waitFor(() => expect(box.querySelector("strong")).toBeTruthy());
}
describe("BE-6 mark edits and keep the original", () => {
  it("only the author has Edit in the menu", async () => {
    mount();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Answer menu" }), { button: 0, ctrlKey: false });
    expect(await screen.findByRole("menuitem", { name: EDIT_COPY.edit })).toBeTruthy();
    cleanup(); mount({ ownership: "teammate" });
    expect(screen.queryByRole("button", { name: "Answer menu" })).toBeNull();
    fireEvent.doubleClick(screen.getByText("Original answer"));
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("commits once, preserving the exact original bytes and emitting safe bands", async () => {
    const { commit } = mount(); const box = await edit(); await bold(box);
    fireEvent.keyDown(box, { key: "Escape" });
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    const saved = parseAnswerBody(commit.mock.calls[0]?.[0] ?? "");
    expect(saved.original).toBe(node.summary);
    expect(saved.html).toContain("<strong>");
    await waitFor(() => expect(logEvent).toHaveBeenCalledWith("answer.edited", "org", { change_band: answerChangeBand(node.summary, saved.text), first_edit: "true" }));
    expect(vi.mocked(logEvent).mock.calls.filter(([name]) => name === "workboard.node_edited")).toEqual([["workboard.node_edited", "org", { kind: "answer" }]]);
    fireEvent.pointerDown(document.body); expect(commit).toHaveBeenCalledTimes(1);
  });
  it("classifies format-only, light, moderate and heavy changes", () => {
    expect(answerChangeBand("same words", "same words")).toBe("format_only");
    expect(answerChangeBand("one two three four five six seven eight nine ten", "one two three four five six seven eight nine eleven")).toBe("moderate");
    expect(answerChangeBand("one two three four five six seven eight nine ten eleven twelve thirteen fourteen", "one two three four five six seven eight nine ten eleven twelve thirteen fifteen")).toBe("light");
    expect(answerChangeBand("old original answer", "entirely different reasoning")).toBe("heavy");
    expect(answerChangeBand("repeat repeat repeat", "repeat")).toBe("heavy");
  });
  it("format-only edits emit the exact format_only dim", async () => {
    mount({ summary: "Original answer" }); const box = await edit(); await bold(box);
    fireEvent.keyDown(box, { key: "Escape" });
    await waitFor(() => expect(logEvent).toHaveBeenCalledWith("answer.edited", "org", { change_band: "format_only", first_edit: "true" }));
  });
  it("marks an edited answer and opens its read-only original once per open", async () => {
    mount({ summary: "Changed", html: "<p><strong>Changed</strong></p>", original: "**Original** answer", editedAt: "2026-10-12T23:00:00Z" });
    expect(await screen.findByText("Changed")).toHaveProperty("tagName", "STRONG");
    expect(screen.getByText(/Edited by you/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: EDIT_COPY.seeOriginal }));
    expect(await screen.findByRole("region", { name: EDIT_COPY.original })).toBeTruthy();
    expect(screen.getByText("Original").tagName).toBe("STRONG");
    expect(logEvent).toHaveBeenCalledWith("answer.original_viewed", "org", {});
    fireEvent.click(screen.getByRole("button", { name: EDIT_COPY.hideOriginal }));
    expect(screen.queryByRole("region")).toBeNull(); expect(logEvent).toHaveBeenCalledTimes(1);
    cleanup(); mount({ ownership: "teammate", summary: "Changed", original: "Original", editedAt: "now" });
    expect(screen.getByText(/Edited by Liam/)).toBeTruthy();
  });
  it("validation errors keep the editor open with the server message and no edit events", async () => {
    const commit = vi.fn<(body: string) => Promise<string | null>>().mockResolvedValue("The original answer is kept as it was.");
    mount({}, commit); const box = await edit(); await bold(box);
    fireEvent.keyDown(box, { key: "Escape" });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "The original answer is kept as it was.");
    expect(screen.getByRole("textbox", { name: "Text" })).toBeTruthy(); expect(logEvent).not.toHaveBeenCalled();
  });
  it("unchanged closing saves nothing", async () => {
    const { commit } = mount(); const box = await edit(); fireEvent.keyDown(box, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(commit).not.toHaveBeenCalled(); expect(logEvent).not.toHaveBeenCalled();
  });
  it("registers only additive content-free catalog dimensions and pins copy", () => {
    expect(EVENT_DIM_KEYS["answer.edited"]).toEqual(["change_band", "first_edit"]);
    expect(EVENT_DIM_KEYS["answer.original_viewed"]).toEqual([]);
    expect(guardEventDims("answer.edited", { change_band: "heavy", first_edit: "false", words: "secret" }).dims).toEqual({ change_band: "heavy", first_edit: "false" });
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain('result.status === "validation_error" ? result.message');
    expect(page).toContain('report(result, "node", "update")');
    expect(EDIT_COPY).toEqual({ edit: "Edit", seeOriginal: "See original", hideOriginal: "Hide original", original: "Original answer", editedYou: "Edited by you", editedBy: "Edited by", saveError: "Could not save your last change." });
    expect(Object.values(EDIT_COPY).join(" ")).not.toMatch(/—|\b(score|monitor|track|surveillance|analytics)\b/i);
  });
});