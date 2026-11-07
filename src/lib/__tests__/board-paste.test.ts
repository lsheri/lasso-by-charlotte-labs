// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOARD_PASTE_TEXT_CAP, pasteBelongsToBoard, readClipboardItems, readPaste, type PasteInput } from "@/lib/board-paste";

const { announce, pasted } = vi.hoisted(() => ({ announce: vi.fn(), pasted: vi.fn() }));
vi.mock("sonner", () => ({ toast: announce }));
vi.mock("@/components/canvas-lab/canvas-lab-telemetry", () => ({ noteWorkboardPasted: pasted }));
vi.mock("@/components/canvas-lab/board-image", () => ({ isBoardImageFile: (file: File) => file.type.startsWith("image/") }));
import { useBoardPaste } from "@/components/canvas-lab/useBoardPaste";

afterEach(() => { cleanup(); vi.restoreAllMocks(); announce.mockClear(); pasted.mockClear(); });

const png = { name: "image.png", type: "image/png" };
const input = (p: Partial<PasteInput>): PasteInput => ({ files: [], text: "", html: "", uriList: "", ...p });

describe("PASTE-1 readPaste", () => {
  it("reads a clipboard PNG and text, then chooses files", async () => {
    const item = {
      presentationStyle: "unspecified",
      types: ["image/png", "text/plain", "text/html"],
      getType: async (type: string) => type === "image/png" ? new Blob(["png"], { type }) : ({ text: async () => type === "text/plain" ? "Memo" : "<b>Memo</b>" } as Blob),
    } as ClipboardItem;
    const result = await readClipboardItems([item]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toBeInstanceOf(File);
    expect(result.files[0]).toMatchObject({ name: "pasted-image.png", type: "image/png" });
    expect(result).toMatchObject({ text: "Memo", html: "<b>Memo</b>", uriList: "" });
    expect(readPaste(result)).toEqual({ kind: "files" });
  });
  it("a macOS screenshot is files", () => expect(readPaste(input({ files: [png] }))).toEqual({ kind: "files" }));
  it("FigJam Copy as PNG is files", () => expect(readPaste(input({ files: [png], html: "<b>(figma)</b>" }))).toEqual({ kind: "files" }));
  it("FigJam plain copy is refused figma", () =>
    expect(readPaste(input({ html: '<span data-metadata="<!--(figmeta)x(/figmeta)-->">' }))).toEqual({ kind: "refused", reason: "figma" }));
  it("Finder single file in Chrome is refused finder", () =>
    expect(readPaste(input({ files: [png], text: "report.pdf" }))).toEqual({ kind: "refused", reason: "finder" }));
  it("Finder several files is refused finder", () =>
    expect(readPaste(input({ files: [png], text: "a.pdf\rb.docx" }))).toEqual({ kind: "refused", reason: "finder" }));
  it("a browser that gives the real file is files", () =>
    expect(readPaste(input({ files: [{ name: "report.pdf", type: "application/pdf" }], text: "report.pdf" }))).toEqual({ kind: "files" }));
  it("a file uri list with no files is refused finder", () =>
    expect(readPaste(input({ uriList: "file:///Users/x/report.pdf" }))).toEqual({ kind: "refused", reason: "finder" }));
  it("Excel cells are files", () => expect(readPaste(input({ files: [png], text: "A\tB\n1\t2" }))).toEqual({ kind: "files" }));
  it("plain text is text, not capped", () =>
    expect(readPaste(input({ text: "Confirm approval" }))).toEqual({ kind: "text", text: "Confirm approval", capped: false }));
  it("5000 characters is capped at 4000", () => {
    const read = readPaste(input({ text: "x".repeat(5000) }));
    expect(read.kind).toBe("text");
    if (read.kind !== "text") return;
    expect(read.text.length).toBe(BOARD_PASTE_TEXT_CAP);
    expect(read.text.length).toBe(4000);
    expect(read.capped).toBe(true);
  });
  it("everything empty is none", () => expect(readPaste(input({}))).toEqual({ kind: "none" }));
});

describe("PASTE-1 pasteBelongsToBoard", () => {
  it("a textarea target is not the board", () => {
    const t = document.createElement("textarea");
    document.body.appendChild(t);
    expect(pasteBelongsToBoard(t, document.body)).toBe(false);
  });
  it("a body target with body active is the board", () => expect(pasteBelongsToBoard(document.body, document.body)).toBe(true));
  it("inside .ask-draft is not the board", () => {
    const host = document.createElement("section");
    host.className = "ask-draft";
    const inner = document.createElement("div");
    host.appendChild(inner);
    document.body.appendChild(host);
    expect(pasteBelongsToBoard(inner, document.body)).toBe(false);
  });
  it("inside role dialog is not the board", () => {
    const d = document.createElement("div");
    d.setAttribute("role", "dialog");
    const inner = document.createElement("span");
    d.appendChild(inner);
    document.body.appendChild(d);
    expect(pasteBelongsToBoard(inner, document.body)).toBe(false);
  });
});

describe("PASTE-2 shared paste path", () => {
  const at = { x: 12, y: 34 };
  function clipboard(value: Partial<Clipboard>) {
    Object.defineProperty(navigator, "clipboard", { configurable: true, get: () => value });
  }
  function harness() {
    document.body.focus();
    const addFiles = vi.fn(async () => ({ added: 1, failed: 0 }));
    const addText = vi.fn(async () => true);
    const hook = renderHook(() => useBoardPaste({
      enabled: true, shellRef: { current: document.body }, toBoard: () => at,
      viewportPoint: () => at, addFiles, addText, orgId: "o",
    }));
    return { ...hook, addFiles, addText };
  }

  it("menu and keys both add text at the requested point with their own via", async () => {
    const read = vi.fn(async () => [{ types: ["text/plain"], presentationStyle: "unspecified", getType: async () => ({ text: async () => "Memo" } as Blob) } as ClipboardItem]);
    clipboard({ read });
    const hook = harness();
    await act(() => hook.result.current.pasteFromClipboard(at));
    expect(hook.addText).toHaveBeenLastCalledWith("Memo", at);
    expect(pasted).toHaveBeenLastCalledWith("o", "text", "added", "menu");
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { files: [], getData: (type: string) => type === "text/plain" ? "Memo" : "" } });
    await act(async () => { document.body.dispatchEvent(event); });
    expect(hook.addText).toHaveBeenCalledTimes(2);
    expect(pasted).toHaveBeenLastCalledWith("o", "text", "added", "keys");
    expect(event.defaultPrevented).toBe(true);
  });

  it("reports unsupported menu access without reading or adding content", async () => {
    clipboard({});
    const hook = harness();
    await act(() => hook.result.current.pasteFromClipboard(at));
    expect(announce).toHaveBeenCalledWith("Your browser cannot paste from a menu. Press Cmd+V on the board instead.");
    expect(pasted).toHaveBeenCalledWith("o", "text", "failed", "menu");
    expect(hook.addText).not.toHaveBeenCalled();
  });

  it("reports denied clipboard access without adding content", async () => {
    clipboard({ read: async () => { throw new Error("denied"); } });
    const hook = harness();
    await act(() => hook.result.current.pasteFromClipboard(at));
    expect(announce).toHaveBeenCalledWith("Paste needs clipboard access. Allow it in the address bar, or press Cmd+V.");
    expect(pasted).toHaveBeenCalledWith("o", "text", "failed", "menu");
    expect(hook.addText).not.toHaveBeenCalled();
  });
});
