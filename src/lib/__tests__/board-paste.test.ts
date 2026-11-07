// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { BOARD_PASTE_TEXT_CAP, pasteBelongsToBoard, readClipboardItems, readPaste, type PasteInput } from "@/lib/board-paste";

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
