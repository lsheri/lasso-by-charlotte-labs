// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LabSection } from "@/components/canvas-lab/LabSection";
import { applyDurableBoard } from "@/components/canvas-lab/canvas-lab-model";
import { noteWorkboardSection } from "@/components/canvas-lab/canvas-lab-telemetry";
import { guardWorkboardEvent } from "@/lib/workboard-event-allowlist";
import { logEvent } from "@/lib/telemetry";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const frame = { id: "section:pricing", name: "Pricing", x: 10, y: 20, width: 400, height: 300 };
function props() {
  return { frame, title: "Pricing", selected: true, editable: true, onSelect: vi.fn(), onDragStart: vi.fn(), onResizeStart: vi.fn(), onResizeKeyDown: vi.fn(), onResizeKeyUp: vi.fn(), onRename: vi.fn(), onRemove: vi.fn(), onMenuOpened: vi.fn() };
}
describe("SEC-2 section", () => {
  it("keeps a reloaded untitled section's key and empty name", () => {
    const result = applyDurableBoard({ frames: [], nodes: [] }, {
      id: "board", engagementId: "engagement", version: 1, viewerProfileId: null,
      canEditStructure: false, archivedContextFrame: null, nodes: [], links: [],
      frames: [{ id: "saved-frame", key: "section:abc", kind: "custom", taskId: null, label: null, fill: null, x: 10, y: 20, w: 400, h: 300, ord: 0, version: 1 }],
    });
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0]?.id).toBe("section:abc");
    expect(result.frames[0]?.name).toBe("");
  });
  it("renders its title and offers an untitled name editor", () => {
    const p = props();
    const view = render(<LabSection {...p} />);
    expect(screen.getByText("Pricing")).toBeTruthy();
    view.rerender(<LabSection {...p} title={null} selected={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Name this section" }));
    expect(screen.getByRole("textbox", { name: "Section title" })).toBeTruthy();
  });
  it("does not select from the interior but selects and starts drag from the title", () => {
    const p = props(); render(<LabSection {...p} />);
    fireEvent.pointerDown(screen.getByTestId("lab-section-section:pricing"), { button: 0 });
    expect(p.onSelect).not.toHaveBeenCalled(); expect(p.onDragStart).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText("Pricing"), { button: 0 });
    expect(p.onSelect).toHaveBeenCalledOnce(); expect(p.onDragStart).toHaveBeenCalledOnce();
  });
  it("selects and starts drag from all four edges", () => {
    const p = props(); render(<LabSection {...p} />);
    screen.getByTestId("lab-section-section:pricing").querySelectorAll("[data-section-edge]").forEach((edge) => fireEvent.pointerDown(edge, { button: 0 }));
    expect(p.onDragStart).toHaveBeenCalledTimes(4);
  });
  it("dragging an untitled section from an edge or title does not open its editor", () => {
    const p = props();
    const view = render(<LabSection {...p} title={null} selected={false} />);
    const edge = screen.getByTestId("lab-section-section:pricing").querySelector('[data-section-edge="top"]');
    if (!edge) throw new Error("Missing section edge");
    fireEvent.pointerDown(edge, { button: 0, clientX: 20, clientY: 20 });
    view.rerender(<LabSection {...p} title={null} selected />);
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.pointerUp(edge, { clientX: 80, clientY: 80 });
    const title = screen.getByRole("button", { name: "Name this section" });
    fireEvent.pointerDown(title, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(title, { clientX: 80, clientY: 80 });
    fireEvent.click(title, { detail: 1, clientX: 80, clientY: 80 });
    expect(p.onDragStart).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("automatically names only the newly created section once", () => {
    const p = props();
    const view = render(<LabSection {...p} title={null} autoName />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    view.rerender(<LabSection {...p} title={null} autoName selected={false} />);
    view.rerender(<LabSection {...p} title={null} autoName selected />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(p.onRename).not.toHaveBeenCalled();
  });
  it("Delete removes a focused section", () => {
    const p = props(); render(<LabSection {...p} />);
    const box = screen.getByTestId("lab-section-section:pricing"); box.focus(); fireEvent.keyDown(box, { key: "Delete" });
    expect(p.onRemove).toHaveBeenCalledOnce();
  });
  it("an empty Enter commit leaves the section untitled without removing it", () => {
    const p = props(); render(<LabSection {...p} />); fireEvent.doubleClick(screen.getByText("Pricing"));
    const input = screen.getByRole("textbox"); fireEvent.change(input, { target: { value: "   " } }); fireEvent.keyDown(input, { key: "Enter" });
    expect(p.onRename).toHaveBeenCalledExactlyOnceWith(null); expect(p.onRemove).not.toHaveBeenCalled();
  });
  it("Escape cancels and blur commits a trimmed title", () => {
    const p = props(); render(<LabSection {...p} />); fireEvent.doubleClick(screen.getByText("Pricing"));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" }); expect(p.onRename).not.toHaveBeenCalled();
    fireEvent.doubleClick(screen.getByText("Pricing")); const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: " Delivery " } }); fireEvent.blur(input); expect(p.onRename).toHaveBeenCalledExactlyOnceWith("Delivery");
  });
  it("read-only sections have no handles, menu or title editor", () => {
    const p = props(); render(<LabSection {...p} editable={false} />); fireEvent.doubleClick(screen.getByText("Pricing"));
    fireEvent.keyDown(screen.getByTestId("lab-section-section:pricing"), { key: "Delete" });
    expect(screen.queryByRole("textbox")).toBeNull(); expect(screen.queryByRole("button")).toBeNull(); expect(p.onRemove).not.toHaveBeenCalled();
  });
  it("opens the same menu on title right-click", () => {
    const p = props(); render(<LabSection {...p} />); fireEvent.contextMenu(screen.getByText("Pricing"));
    expect(screen.getByRole("menuitem", { name: "Remove section" })).toBeTruthy(); expect(p.onMenuOpened).toHaveBeenCalledOnce();
  });
});
describe("section events", () => {
  it("created carries only drawn via", () => {
    noteWorkboardSection("org", "created"); expect(logEvent).toHaveBeenCalledExactlyOnceWith("workboard.section_created", "org", { via: "drawn" });
    expect(guardWorkboardEvent("workboard.section_created", { via: "drawn", creator: "private" })).toEqual({ keep: true, dims: { via: "drawn" } });
  });
  it("moved carries only frame and card counts", () => {
    noteWorkboardSection("org", "moved", { frames: 2, cards: 3 }); expect(logEvent).toHaveBeenCalledExactlyOnceWith("workboard.section_moved", "org", { frames: 2, cards: 3 });
    expect(guardWorkboardEvent("workboard.section_moved", { frames: 2, cards: 3, person: "private" })).toEqual({ keep: true, dims: { frames: 2, cards: 3 } });
  });
  it("removed carries no dimensions", () => {
    noteWorkboardSection("org", "removed"); expect(logEvent).toHaveBeenCalledExactlyOnceWith("workboard.section_removed", "org", {});
    expect(guardWorkboardEvent("workboard.section_removed", { person: "private" })).toEqual({ keep: true, dims: {} });
  });
});