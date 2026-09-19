// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/work/WorkNote", () => ({
  WorkNote: ({ className = "" }: { className?: string }) => <div className={`nb-paper ${className}`}><div className="nb-paper-body">Work title</div></div>,
}));

import { LabCard } from "@/components/canvas-lab/LabCard";
import { createLocalNode, ownerLabel, panToRevealNode, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { ReasoningTrailGuide } from "@/components/canvas-lab/ReasoningTrailGuide";

const localJudgment: LabNode = { id: "judgment", kind: "judgment", frame: "f", title: "Set the tier 2 floor at $4,200 per seat", summary: "Reason", typeLabel: "Added constraint", ownership: "draft", local: true, x: 900, y: 700, width: 232, height: 112 };

function renderCard(node: LabNode, selected = true) {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as typeof ResizeObserver;
  return render(<LabCard node={node} selected={selected} focused={false} connecting={false} connectSourceAnchor={null} canResize={false} onSelect={() => undefined} onOpen={() => undefined} onBranch={() => undefined} onHide={() => undefined} onDelete={() => undefined} onEdit={() => undefined} onEditCommitted={() => undefined} onAnchorPointerDown={() => undefined} onAnchorActivate={() => undefined} onMenuOpened={() => undefined} onMenuOpenChange={() => undefined} onMeasure={() => undefined} onPointerDown={() => undefined} onFocus={() => undefined} onKeyDown={() => undefined} onResizeStart={() => undefined} onFit={() => undefined} onResizeKeyDown={() => undefined} onResizeKeyUp={() => undefined} frameChoices={[]} structured onMoveToFrame={() => undefined} />);
}

afterEach(cleanup);

describe("Workboard human judgment", () => {
  it("focuses a mouse-created judgment and Enter reaches its context action", () => {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as typeof ResizeObserver;
    const selected = vi.fn();
    function Harness() {
      const [node, setNode] = useState<LabNode | null>(null);
      return <><ReasoningTrailGuide onAdd={() => setNode({ ...localJudgment, id: "local-node:focus" })} />{node ? <LabCard node={node} selected={false} focused focusOnMount connecting={false} connectSourceAnchor={null} canResize={false} onSelect={selected} onOpen={() => undefined} onBranch={() => undefined} onHide={() => undefined} onDelete={() => undefined} onEdit={() => undefined} onEditCommitted={() => undefined} onAnchorPointerDown={() => undefined} onAnchorActivate={() => undefined} onMenuOpened={() => undefined} onMenuOpenChange={() => undefined} onMeasure={() => undefined} onPointerDown={() => undefined} onFocus={() => undefined} onKeyDown={(event) => { if (event.key === "Enter") selected(); }} onResizeStart={() => undefined} onFit={() => undefined} onResizeKeyDown={() => undefined} onResizeKeyUp={() => undefined} frameChoices={[]} structured onMoveToFrame={() => undefined} /> : null}</>;
    }
    render(<Harness />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Add Human judgment local node" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Human judgment local node" }));
    const choice = screen.getByRole("menuitem", { name: "Corrected AI" });
    fireEvent.pointerDown(choice);
    fireEvent.click(choice);
    const card = screen.getByRole("group", { name: localJudgment.title });
    expect(document.activeElement).toBe(card);
    fireEvent.keyDown(card, { key: "Enter" });
    expect(selected).toHaveBeenCalledOnce();
  });

  it("opens the chooser from a pointer click and closes after a choice", () => {
    const onAdd = vi.fn();
    render(<ReasoningTrailGuide onAdd={onAdd} />);
    const trigger = screen.getByRole("button", { name: "Add Human judgment local node" });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const choice = screen.getByRole("menuitem", { name: "Corrected AI" });
    fireEvent.pointerDown(choice);
    fireEvent.click(choice);
    expect(onAdd).toHaveBeenCalledWith("judgment", "corrected_ai");
    expect(screen.queryByRole("menu", { name: "Human judgment type" })).toBeNull();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    render(<ReasoningTrailGuide onAdd={() => undefined} />);
    const trigger = screen.getByRole("button", { name: "Add Human judgment local node" });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Human judgment type" });
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Human judgment type" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    vi.unstubAllGlobals();
  });

  it("closes on pointerdown outside", () => {
    render(<><ReasoningTrailGuide onAdd={() => undefined} /><button type="button">Outside</button></>);
    fireEvent.click(screen.getByRole("button", { name: "Add Human judgment local node" }));
    expect(screen.getByRole("menu", { name: "Human judgment type" })).not.toBeNull();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("menu", { name: "Human judgment type" })).toBeNull();
  });

  it("labels durable judgment authorship without changing local semantics", () => {
    expect(ownerLabel({ ...localJudgment, durableId: "own", ownership: "draft" })).toBe("yours");
    expect(ownerLabel({ ...localJudgment, durableId: "other", ownership: "teammate", local: false })).toBe("teammate");
    expect(ownerLabel(localJudgment)).toBe("local draft");
    expect(ownerLabel({ ...localJudgment, kind: "chat", durableId: "chat", ownership: "yours" })).toBe("local draft");
  });

  it("reserves context-mark space for folded and work-note titles", () => {
    const folded = renderCard(localJudgment);
    expect(folded.container.querySelector(".canvas-lab-context-title")).not.toBeNull();
    expect(folded.container.querySelector(".canvas-lab-context-header")).not.toBeNull();
    folded.unmount();
    const item = { id: "work", title: localJudgment.title, type: "document", source: "upload", visibility: "shared", created_at: "2026-09-19T00:00:00Z", updated_at: "2026-09-19T00:00:00Z" } as never;
    const work = renderCard({ ...localJudgment, kind: "work", workItemId: "work" });
    work.rerender(<LabCard node={{ ...localJudgment, kind: "work", workItemId: "work" }} item={item} selected focused={false} connecting={false} connectSourceAnchor={null} canResize={false} onSelect={() => undefined} onOpen={() => undefined} onBranch={() => undefined} onHide={() => undefined} onDelete={() => undefined} onEdit={() => undefined} onEditCommitted={() => undefined} onAnchorPointerDown={() => undefined} onAnchorActivate={() => undefined} onMenuOpened={() => undefined} onMenuOpenChange={() => undefined} onMeasure={() => undefined} onPointerDown={() => undefined} onFocus={() => undefined} onKeyDown={() => undefined} onResizeStart={() => undefined} onFit={() => undefined} onResizeKeyDown={() => undefined} onResizeKeyUp={() => undefined} frameChoices={[]} structured onMoveToFrame={() => undefined} />);
    expect(work.container.querySelector(".canvas-lab-work-note-context")).not.toBeNull();
  });

  it("uses the first board-wide collision-free stack slot for a new judgment", () => {
    const frame = { id: "task:one", name: "Tier 2", x: 500, y: 1280, width: 800, height: 600, kind: "task" as const };
    const blocking = { ...localJudgment, id: "requested", frame: "other", x: 550, y: 1342, width: 232, height: 112 };
    const created = createLocalNode("judgment", frame, [blocking], "corrected_ai");
    expect([created.x, created.y]).not.toEqual([blocking.x, blocking.y]);
    expect(created.x >= blocking.x + blocking.width || created.x + created.width <= blocking.x || created.y >= blocking.y + blocking.height || created.y + created.height <= blocking.y).toBe(true);
  });

  it("gives all five reasoning Add buttons the same hit-area class", () => {
    render(<ReasoningTrailGuide onAdd={() => undefined} />);
    expect(screen.getAllByRole("button", { name: /Add .* local node/ }).every((button) => button.classList.contains("canvas-lab-step-add"))).toBe(true);
  });

  it("centres an off-screen new card and leaves a visible card alone", () => {
    expect(panToRevealNode({ x: 0, y: 0 }, 0.5, { ...localJudgment, x: 20, y: 20 }, { width: 800, height: 600 })).toEqual({ x: 0, y: 0 });
    expect(panToRevealNode({ x: 0, y: 0 }, 0.5, { ...localJudgment, x: 1800, y: 1300 }, { width: 800, height: 600 })).toEqual({ x: -558, y: -378 });
  });
});