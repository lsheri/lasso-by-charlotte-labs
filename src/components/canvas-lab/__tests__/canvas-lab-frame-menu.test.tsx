// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabFrame } from "@/components/canvas-lab/LabFrame";
import type { LabFrame as LabFrameModel } from "@/components/canvas-lab/canvas-lab-model";

const customFrame: LabFrameModel = { id: "custom:risks", name: "Risks", x: 0, y: 0, width: 430, height: 520, local: true };

function renderFrame(overrides: Partial<React.ComponentProps<typeof LabFrame>> = {}) {
  const props: React.ComponentProps<typeof LabFrame> = {
    frame: customFrame,
    count: 0,
    selected: true,
    editable: true,
    custom: true,
    namedByWorkstream: false,
    removable: true,
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

afterEach(() => document.body.replaceChildren());

describe("LabFrame menu and rename", () => {
  it("offers all three actions on an editable custom workstream", () => {
    const { props } = renderFrame();
    fireEvent.click(screen.getByRole("button", { name: "Open workstream menu" }));
    expect(screen.getByRole("menuitem", { name: "Fit contents" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Remove workstream" })).toBeTruthy();
    expect(props.onMenuOpened).toHaveBeenCalledTimes(1);
  });

  it("keeps the menu read-only for coaches and limits task workstreams to Fit", () => {
    const first = renderFrame({ editable: false });
    fireEvent.click(screen.getByRole("button", { name: "Open workstream menu" }));
    expect(screen.queryByRole("menuitem")).toBeNull();
    first.unmount();
    renderFrame({ custom: false, namedByWorkstream: true, frame: { ...customFrame, id: "task:1", name: "Discovery", local: false } });
    fireEvent.click(screen.getByRole("button", { name: "Open workstream menu" }));
    expect(screen.getByRole("menuitem", { name: "Fit contents" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Rename" })).toBeNull();
    expect(screen.getByText("Discovery").getAttribute("title")).toBe("Named by the workstream");
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
    fireEvent.click(screen.getByRole("button", { name: "Open workstream menu" }));
    expect(screen.getByRole("menuitem", { name: /Remove workstream/ }).getAttribute("data-disabled")).not.toBeNull();
    expect(screen.getByText(/Move its cards first/)).toBeTruthy();
  });
});