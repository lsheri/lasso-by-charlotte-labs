import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardToolbarSurface, type BoardToolbarItem } from "@/components/canvas-lab/BoardToolbarSurface";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

describe("TOOLBAR-5 independent surfaces", () => {
  it("keeps the floating overflow actionable without starting a canvas press", () => {
    let presses = 0;
    const items: BoardToolbarItem[] = [
      { spec: { id: "add-work", width: Number.MAX_SAFE_INTEGER, pinned: true, group: 1 }, row: <span>Add work</span> },
      { spec: { id: "add-text", width: 40, group: 2 }, row: <span>Add text</span>, menu: <DropdownMenuItem>Add text</DropdownMenuItem> },
    ];
    render(<TooltipProvider><div onPointerDown={() => { presses += 1; }}><BoardToolbarSurface surface="floating" items={items} /></div></TooltipProvider>);
    const more = screen.getByRole("button", { name: "More drawing tools" });
    fireEvent.pointerDown(more, { button: 0, ctrlKey: false, pointerType: "mouse" });
    expect(presses).toBe(0);
    expect(screen.getByRole("menuitem", { name: "Add text" })).toBeInTheDocument();
  });
});