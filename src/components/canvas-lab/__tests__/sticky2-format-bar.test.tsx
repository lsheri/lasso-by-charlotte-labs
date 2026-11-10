// @vitest-environment jsdom
// STICKY-2: the slim bar above a selected sticky, the toolbar drag-out, and the last colour used.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabSticky } from "@/components/canvas-lab/LabSticky";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }) });

const node = { id: "one", kind: "sticky", title: "", summary: "Hello", typeLabel: "", ownership: "yours", local: true, x: 0, y: 0, width: 200, height: 140 } as unknown as LabNode;
function mount(extra: Partial<{ editable: boolean; selected: boolean }> = {}) {
  const props = { node, selected: extra.selected ?? true, editable: extra.editable ?? true, layoutEditable: true, onSelect: vi.fn(), onDragStart: vi.fn(), onResizeStart: vi.fn(), onResizeKeyDown: vi.fn(), onResizeKeyUp: vi.fn(), onChange: vi.fn(), onCommit: vi.fn(), onRemove: vi.fn() };
  render(<LabSticky {...props} />);
  return props;
}
const page = readFileSync(resolve(process.cwd(), "src/pages/CanvasLabPage.tsx"), "utf8");

describe("STICKY-2 slim bar, drag-out, last colour", () => {
  afterEach(cleanup);

  it("shows colour, size, bold and delete at once, with no pencil and no menus", () => {
    const props = mount();
    const bar = within(screen.getByRole("group", { name: "Sticky formatting" }));
    expect(screen.queryByRole("button", { name: "Formatting" })).toBeNull();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(within(bar.getByRole("group", { name: "Sticky colour" })).getAllByRole("button")).toHaveLength(5);
    // S1: swatches are named as people see them; the stored key stays "green".
    fireEvent.click(bar.getByRole("button", { name: "Mint" }));
    expect(props.onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ fill: "green" }), "fill");
    fireEvent.click(bar.getByRole("button", { name: "Heading text" }));
    expect(props.onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ size: "heading" }), "style");
    fireEvent.click(bar.getByRole("button", { name: "Bold" }));
    expect(props.onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ weight: "bold" }), "style");
    fireEvent.click(bar.getByRole("button", { name: "Remove sticky" }));
    expect(props.onRemove).toHaveBeenCalledOnce();
  });

  it("link and list appear only while typing", async () => {
    mount();
    expect(screen.queryByRole("button", { name: "Link and list" })).toBeNull();
    fireEvent.doubleClick(screen.getByTestId("sticky-one"));
    await screen.findByRole("textbox", { name: "Text" });
    expect(screen.getByRole("button", { name: "Link and list" })).toBeTruthy();
  });

  it("someone else's sticky offers nothing to format", () => {
    mount({ editable: false });
    expect(screen.queryByRole("group", { name: "Sticky colour" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
  });

  it("the toolbar sticky drags out to where it is dropped, and a click still drops one in the middle", () => {
    expect(page).toContain('data-toolbar-control="add-sticky" onPointerDown={startStickyDragOut}');
    expect(page).toContain("if (stickyDragOutRef.current) { stickyDragOutRef.current = false; return; } void addSticky(); }");
    expect(page).toContain("void addSticky(boardPointFromScreen({ x: next.clientX - rect.left, y: next.clientY - rect.top }));");
    expect(page).toContain('data-testid="sticky-drag-ghost"');
  });

  it("a new sticky takes the last colour picked", () => {
    expect(page).toContain('if (field === "fill") lastStickyFillRef.current = body.fill;');
    expect(page).toContain("stickyFill: lastStickyFillRef.current, local: true,");
  });
});
