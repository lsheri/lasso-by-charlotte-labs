// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LabFrame } from "@/components/canvas-lab/LabFrame";

describe("dbg", () => {
  it("dbg", () => {
    render(<LabFrame frame={{ id: "custom:risks", name: "Risks", x: 0, y: 0, width: 430, height: 520, local: true }} count={0} selected editable custom namedByWorkstream={false} removable kind="custom" onSelect={vi.fn()} onResizeStart={vi.fn()} onResizeKeyDown={vi.fn()} onResizeKeyUp={vi.fn()} onFit={vi.fn()} onRename={vi.fn()} onRemove={vi.fn()} onMenuOpened={vi.fn()} onMenuOpenChange={vi.fn()} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open workstream menu" }), { button: 0, ctrlKey: false });
    const item = screen.getByRole("menuitem", { name: "Rename" });
    fireEvent.click(item);
    console.log(document.body.innerHTML.slice(0, 1200));
    expect(true).toBe(true);
  });
});
