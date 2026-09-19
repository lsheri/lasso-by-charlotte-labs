// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabFrame } from "@/components/canvas-lab/LabFrame";
import type { LabFrame as LabFrameModel } from "@/components/canvas-lab/canvas-lab-model";

const customFrame: LabFrameModel = { id: "custom:risks", name: "Risks", x: 0, y: 0, width: 430, height: 520, local: true };

afterEach(cleanup);

function renderFrame(overrides: Partial<React.ComponentProps<typeof LabFrame>> = {}) {
  const props: React.ComponentProps<typeof LabFrame> = {
    frame: customFrame,
    count: 0,
    selected: true,
    editable: true,
    custom: true,
    namedByWorkstream: false,
    removable: true,
    kind: "custom",
    onSelect: vi.fn(),
    onResizeStart: vi.fn(),
    onResizeKeyDown: vi.fn(),
    onResizeKeyUp: vi.fn(),
    onFit: vi.fn(),
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onMenuOpened: vi.fn(),
    onMenuOpenChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<LabFrame {...props} />), props };
}

describe("LabFrame menu and rename", () => {
  it("offers all three actions on an editable custom workstream", () => {
    const { props } = renderFrame();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open workstream menu" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("menuitem", { name: "Fit contents" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Remove workstream" })).toBeTruthy();
    expect(props.onMenuOpened).toHaveBeenCalledTimes(1);
  });

  it("hides the menu for coaches and limits task workstreams to Fit", () => {
    const first = renderFrame({ editable: false });
    expect(screen.queryByRole("button", { name: "Open workstream menu" })).toBeNull();
    fireEvent.contextMenu(screen.getByTestId("lab-frame-custom:risks"));
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(first.props.onMenuOpened).not.toHaveBeenCalled();
    first.unmount();
    renderFrame({ custom: false, kind: "task", namedByWorkstream: true, frame: { ...customFrame, id: "task:1", name: "Discovery", local: false } });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open workstream menu" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("menuitem", { name: "Fit contents" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Rename" })).toBeNull();
    expect(screen.getByText("Discovery").getAttribute("title")).toBe("Named by the workstream");
  });

  it("shows role-appropriate guidance and inline creation only to editors", () => {
    const onAddWorkstream = vi.fn(() => true);
    const first = renderFrame({ kind: "decisions", custom: false, frame: { ...customFrame, id: "decisions", name: "Decisions" } });
    expect(screen.getByText("No decisions recorded on this engagement yet.")).toBeTruthy();
    first.unmount();
    renderFrame({ editable: false, kind: "outputs", custom: false, frame: { ...customFrame, id: "outputs", name: "Outputs" } });
    expect(screen.getByText("Nothing here yet.")).toBeTruthy();
    cleanup();
    renderFrame({ kind: "task", custom: false, frame: { ...customFrame, id: "workstreams", name: "Workstreams" }, onAddWorkstream });
    fireEvent.click(screen.getByRole("button", { name: "+ workstream" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Workstream name" }), { target: { value: "Delivery" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAddWorkstream).toHaveBeenCalledWith("Delivery");
  });

  it("puts the cursor in the rename field when Rename comes from the menu", async () => {
    renderFrame();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open workstream menu" }), { button: 0, ctrlKey: false });
    const item = screen.getByRole("menuitem", { name: "Rename" });
    item.focus();
    fireEvent.keyDown(item, { key: "Enter" });
    const input = await screen.findByRole("textbox", { name: "Rename workstream" });
    await new Promise((resolve) => window.requestAnimationFrame(() => setTimeout(resolve, 0)));
    expect(document.activeElement).toBe(input);
  });

  it("commits trimmed names on Enter and reverts with Escape", () => {
    const { props } = renderFrame();
    fireEvent.doubleClick(screen.getByText("Risks"));
    const input = screen.getByRole("textbox", { name: "Rename workstream" });
    fireEvent.change(input, { target: { value: "  Delivery risks  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onRename).toHaveBeenCalledWith("Delivery risks");

    fireEvent.doubleClick(screen.getByText("Risks"));
    const second = screen.getByRole("textbox", { name: "Rename workstream" });
    fireEvent.change(second, { target: { value: "Discard this" } });
    fireEvent.keyDown(second, { key: "Escape" });
    expect(screen.getByText("Risks")).toBeTruthy();
    expect(props.onRename).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty name and explains how to continue", () => {
    const { props } = renderFrame();
    fireEvent.doubleClick(screen.getByText("Risks"));
    const input = screen.getByRole("textbox", { name: "Rename workstream" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);
    expect(screen.getByText("a workstream needs a name")).toBeTruthy();
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it("disables removal when the workstream still has cards", () => {
    renderFrame({ removable: false });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open workstream menu" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("menuitem", { name: /Remove workstream/ }).getAttribute("data-disabled")).not.toBeNull();
    expect(screen.getByText(/Move its cards first/)).toBeTruthy();
  });
});