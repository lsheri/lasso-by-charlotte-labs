// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LabSticky } from "@/components/canvas-lab/LabSticky";
import { LabTextBlock } from "@/components/canvas-lab/LabTextBlock";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }) });
afterEach(cleanup);

for (const kind of ["sticky", "text"] as const) {
  const Component = kind === "sticky" ? LabSticky : LabTextBlock;
  const removeLabel = kind === "sticky" ? "Remove sticky" : "Remove text block";
  function mount(summary = "Hello") {
    const node: LabNode = { id: "one", kind, title: "", summary, typeLabel: "", ownership: "yours", local: true, x: 0, y: 0, width: 260, height: 160 };
    const props = { node, selected: true, editable: true, layoutEditable: true, onSelect: vi.fn(), onDragStart: vi.fn(), onResizeStart: vi.fn(), onResizeKeyDown: vi.fn(), onResizeKeyUp: vi.fn(), onChange: vi.fn(), onCommit: vi.fn(), onRemove: vi.fn() };
    const view = render(<Component {...props} />);
    return { ...view, props };
  }
  function closed() {
    expect(screen.getByRole("button", { name: "Formatting" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: removeLabel })).toBeTruthy();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryByRole("group", { name: "Sticky colour" })).toBeNull();
    expect(screen.queryByRole("toolbar")).toBeNull();
  }
  describe(`BI-4 ${kind} formatting`, () => {
    it("starts closed, toggles from the pencil without entering edit, and retains every formatting control", () => {
      const { props } = mount();
      closed();
      const pencil = screen.getByRole("button", { name: "Formatting" });
      expect(pencil.getAttribute("title")).toBe("Formatting");
      expect(pencil.tabIndex).toBe(0);
      fireEvent.click(pencil);
      expect(pencil.getAttribute("aria-pressed")).toBe("true");
      expect(screen.queryByRole("textbox", { name: "Text" })).toBeNull();
      expect(screen.getAllByRole("combobox")).toHaveLength(kind === "sticky" ? 2 : 3);
      for (const select of screen.getAllByRole("combobox")) expect(select.tabIndex).toBe(0);
      fireEvent.change(screen.getByRole("combobox", { name: "Text size" }), { target: { value: "heading" } });
      expect(props.onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ size: "heading" }), ...(kind === "sticky" ? ["style"] : []));
      fireEvent.change(screen.getByRole("combobox", { name: "Text weight" }), { target: { value: "bold" } });
      expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ weight: "bold" }));
      if (kind === "sticky") {
        const swatches = within(screen.getByRole("group", { name: "Sticky colour" }));
        expect(swatches.getAllByRole("button")).toHaveLength(5);
        fireEvent.click(swatches.getByRole("button", { name: "green" }));
        expect(props.onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ fill: "green" }), "fill");
      } else {
        fireEvent.change(screen.getByRole("combobox", { name: "Text colour" }), { target: { value: "green" } });
        expect(props.onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ colour: "green" }));
      }
      fireEvent.click(pencil);
      closed();
      fireEvent.click(screen.getByRole("button", { name: removeLabel }));
      expect(props.onRemove).toHaveBeenCalledOnce();
    });
    it("entering edit closes formatting, typing leaves it closed, and the pencil can reopen it explicitly", async () => {
      mount();
      fireEvent.click(screen.getByRole("button", { name: "Formatting" }));
      fireEvent.doubleClick(screen.getByTestId(kind === "sticky" ? "sticky-one" : "text-block-one"));
      const editor = await screen.findByRole("textbox", { name: "Text" });
      closed();
      fireEvent.input(editor);
      closed();
      fireEvent.click(screen.getByRole("button", { name: "Formatting" }));
      expect(screen.getByRole("toolbar")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Formatting" }));
      closed();
    });
    it("deselecting forgets an open panel", () => {
      const { rerender, props } = mount();
      fireEvent.click(screen.getByRole("button", { name: "Formatting" }));
      rerender(<Component {...props} selected={false} />);
      expect(screen.queryByRole("button", { name: "Formatting" })).toBeNull();
      rerender(<Component {...props} />);
      closed();
    });
    it("a new empty node takes typing immediately with formatting closed", async () => {
      mount("");
      const editor = await screen.findByRole("textbox", { name: "Text" });
      await waitFor(() => expect(document.activeElement).toBe(editor));
      closed();
    });
  });
}