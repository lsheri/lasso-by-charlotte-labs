// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { LabSticky } from "@/components/canvas-lab/LabSticky";
import { LabTextBlock } from "@/components/canvas-lab/LabTextBlock";
import { applyDurableBoard, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { serializeWorkboardStickyBody, serializeWorkboardTextBody, type WorkboardDto } from "@/lib/canvas-lab-shared";
import { sanitizeRichHtml } from "@/lib/rich-text";

// jsdom has no selection geometry; ProseMirror's autofocus scroll reads it.
Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }) });
afterEach(cleanup);
const base: LabNode = { id: "one", kind: "sticky", title: "", summary: "Hello", typeLabel: "", ownership: "yours", local: true, x: 0, y: 0, width: 260, height: 160 };
function mount(kind: "sticky" | "text", patch: Partial<LabNode> = {}) {
  const onCommit = vi.fn(); const onChange = vi.fn();
  const props = { node: { ...base, kind, ...patch }, selected: true, editable: true, layoutEditable: true, onSelect: vi.fn(), onDragStart: vi.fn(), onResizeStart: vi.fn(), onResizeKeyDown: vi.fn(), onResizeKeyUp: vi.fn(), onChange, onCommit, onRemove: vi.fn() };
  render(kind === "sticky" ? <LabSticky {...props} /> : <LabTextBlock {...props} />);
  return { onCommit, onChange };
}
describe("BE-5 rich sticky and text edits", () => {
  for (const kind of ["sticky", "text"] as const) {
    it(`${kind}: HTML displays formatted and legacy stays plain`, async () => {
      mount(kind, { html: "<p><strong>Hello</strong></p><ul><li>One</li></ul>" });
      expect(await screen.findByRole("listitem")).toHaveProperty("textContent", "One");
      expect(screen.getByText("Hello").tagName).toBe("STRONG");
      cleanup(); mount(kind, { summary: "**literal**" });
      expect(screen.getByRole("textbox")).toHaveProperty("value", "**literal**");
    });
    it(`${kind}: double-click, formatting, Escape commits safe HTML once`, async () => {
      const { onCommit, onChange } = mount(kind);
      fireEvent.doubleClick(screen.getByTestId(kind === "sticky" ? "sticky-one" : "text-block-one"));
      const box = await screen.findByRole("textbox", { name: "Text" });
      box.focus();
      const range = document.createRange(); range.selectNodeContents(box.querySelector("p") ?? box);
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      fireEvent.keyDown(box, { key: "b", code: "KeyB", ctrlKey: true });
      await waitFor(() => expect(box.querySelector("strong")?.textContent).toBe("Hello"));
      fireEvent.keyDown(box, { key: "Escape" });
      expect(onCommit).toHaveBeenCalledTimes(1); expect(onChange).toHaveBeenCalledTimes(1);
      const body = onCommit.mock.calls[0]?.[0];
      expect(body.text).toBe("Hello"); expect(body.html).toContain("<strong>Hello</strong>");
      expect(body.html).toBe(sanitizeRichHtml(body.html));
      fireEvent.pointerDown(document.body); expect(onCommit).toHaveBeenCalledTimes(1);
    });
    it(`${kind}: closing unchanged saves nothing`, async () => {
      const { onCommit } = mount(kind, { summary: "- First\n- Second", html: "<ul><li><strong>First</strong></li><li>Second</li></ul>" });
      fireEvent.doubleClick(screen.getByTestId(kind === "sticky" ? "sticky-one" : "text-block-one"));
      const box = await screen.findByRole("textbox", { name: "Text" });
      await new Promise((resolve) => setTimeout(resolve, 50));
      fireEvent.keyDown(box, { key: "Escape" }); expect(onCommit).not.toHaveBeenCalled();
    });
    it(`${kind}: new empty node opens and focuses without double-click`, async () => {
      mount(kind, { summary: "" });
      const box = await screen.findByRole("textbox", { name: "Text" });
      await waitFor(() => expect(document.activeElement).toBe(box));
    });
  }
  it("durable reload retains sticky/text HTML and edited answer provenance", () => {
    const html = "<p><strong>Hello</strong></p>";
    const common = { frameId: null, workItemId: null, decisionId: null, authorProfileId: "p", authorName: "Liam", title: "", judgmentType: null, x: 0, y: 0, w: 260, h: 160, hidden: false, version: 1, referenceReadable: true };
    const board: WorkboardDto = { id: "b", engagementId: "e", version: 1, frames: [], links: [], viewerProfileId: "p", canEditStructure: true, archivedContextFrame: null, nodes: [
      { ...common, id: "s", kind: "sticky", body: serializeWorkboardStickyBody({ text: "Hello", html, size: "body", weight: "regular", colour: "ink", fill: "yellow" }) },
      { ...common, id: "t", kind: "text", body: serializeWorkboardTextBody({ text: "Hello", html, size: "label", weight: "medium", colour: "ink" }) },
      { ...common, id: "a", kind: "answer", body: JSON.stringify({ text: "Hello", html, original: "Original answer", edited_at: "2026-10-12T22:00:00Z" }) },
    ] };
    const model = applyDurableBoard({ nodes: [], frames: [] }, board);
    for (const kind of ["sticky", "text", "answer"]) expect(model.nodes.find((node) => node.kind === kind)).toMatchObject({ summary: "Hello", html });
    expect(model.nodes.find((node) => node.kind === "answer")).toMatchObject({ original: "Original answer", editedAt: "2026-10-12T22:00:00Z" });
  });
  it("keeps event calls in the page commit callbacks without new dims", () => {
    const source = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    for (const kind of ["sticky", "text"]) {
      expect(source.match(new RegExp(`noteWorkboardNodeEdited\\(orgId, "${kind}"\\)`, "g"))).toHaveLength(1);
    }
    expect(source).toContain("void persistNodePatch(node.id, { body: serializeWorkboardStickyBody(body) });");
    expect(source).toContain("void persistNodePatch(node.id, { body: serializeWorkboardTextBody(body) });");
  });
});
