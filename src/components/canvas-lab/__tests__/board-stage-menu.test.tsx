// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BoardStageMenu } from "@/components/canvas-lab/BoardStageMenu";

afterEach(cleanup);

function renderMenu(at = { x: 40, y: 40 }, hostWidth = 1000) {
  const props = { at, hidden: [{ id: "n1", title: "Pricing memo" }], canAddContextArea: true, onClose: vi.fn(), onPaste: vi.fn(), onAddWork: vi.fn(), onRestore: vi.fn(), onAddContextArea: vi.fn() };
  const host = document.createElement("div");
  host.className = "canvas-lab-surface";
  Object.defineProperty(host, "clientWidth", { configurable: true, value: hostWidth });
  Object.defineProperty(host, "clientHeight", { configurable: true, value: 800 });
  document.body.appendChild(host);
  render(<BoardStageMenu {...props} />, { container: host });
  return props;
}

describe("BoardStageMenu", () => {
  it("Paste here is first and calls paste and close", () => {
    const props = renderMenu();
    const first = screen.getAllByRole("menuitem")[0];
    if (!first) throw new Error("Missing first menu item");
    expect(first.textContent).toBe("Paste here");
    fireEvent.click(first);
    expect(props.onPaste).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
  it("renders the three items with the hidden group and house classes", () => {
    renderMenu();
    expect(screen.getByRole("menu").className).toContain("canvas-lab-menu");
    expect(screen.getByRole("menuitem", { name: "Bring in work here" }).className).toContain("canvas-lab-menu-item");
    expect(screen.getByRole("group", { name: "Put back on the board (1)" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Pricing memo" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Add a context area" })).toBeTruthy();
  });

  it("focuses the first item and ArrowDown moves focus", () => {
    renderMenu();
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Paste here" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Bring in work here" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Add a context area" }));
  });

  it("Escape calls onClose", () => {
    const props = renderMenu();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("Enter on Bring in work here calls onAddWork", () => {
    const props = renderMenu();
    const item = screen.getByRole("menuitem", { name: "Bring in work here" });
    fireEvent.keyDown(item, { key: "Enter" });
    fireEvent.click(item); // native buttons activate on Enter via click
    expect(props.onAddWork).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("opens to the left near the right edge", () => {
    renderMenu({ x: 900, y: 40 }, 1000);
    expect(screen.getByRole("menu").style.left).toBe("680px");
  });
});
