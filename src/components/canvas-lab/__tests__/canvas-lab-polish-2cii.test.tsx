// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => true }));

import { LabCard } from "@/components/canvas-lab/LabCard";
import { ownerLabel, panToRevealNode, type LabNode } from "@/components/canvas-lab/canvas-lab-model";

const localJudgment: LabNode = { id: "judgment", kind: "judgment", frame: "f", title: "Set the tier 2 floor at $4,200 per seat", summary: "Reason", typeLabel: "Added constraint", ownership: "draft", local: true, x: 900, y: 700, width: 232, height: 112 };

function renderCard(node: LabNode, selected = true) {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as typeof ResizeObserver;
  return render(<LabCard node={node} selected={selected} focused={false} connecting={false} connectSourceAnchor={null} canResize={false} onSelect={() => undefined} onOpen={() => undefined} onBranch={() => undefined} onHide={() => undefined} onDelete={() => undefined} onEdit={() => undefined} onEditCommitted={() => undefined} onAnchorPointerDown={() => undefined} onAnchorActivate={() => undefined} onMenuOpened={() => undefined} onMenuOpenChange={() => undefined} onMeasure={() => undefined} onPointerDown={() => undefined} onFocus={() => undefined} onKeyDown={() => undefined} onResizeStart={() => undefined} onFit={() => undefined} onResizeKeyDown={() => undefined} onResizeKeyUp={() => undefined} frameChoices={[]} structured onMoveToFrame={() => undefined} />);
}

afterEach(cleanup);

describe("Workboard human judgment", () => {
  it("labels durable judgment authorship without changing local semantics", () => {
    expect(ownerLabel({ ...localJudgment, durableId: "own", ownership: "draft" })).toBe("yours");
    expect(ownerLabel({ ...localJudgment, durableId: "other", ownership: "teammate", local: false })).toBe("teammate");
    expect(ownerLabel(localJudgment)).toBe("local draft");
    expect(ownerLabel({ ...localJudgment, kind: "chat", durableId: "chat", ownership: "yours" })).toBe("local draft");
  });

  it("reserves context-mark space for paper titles and owner rows", () => {
    const folded = renderCard(localJudgment);
    expect(folded.container.querySelector(".canvas-lab-context-title")).not.toBeNull();
    const header = folded.container.querySelector(".canvas-lab-context-header");
    expect(header).not.toBeNull();
    expect(header!.classList.contains("pr-6")).toBe(false);
    folded.unmount();
    const item = { id: "work", title: localJudgment.title, type: "document", source: "upload", visibility: "shared", created_at: "2026-09-19T00:00:00Z", updated_at: "2026-09-19T00:00:00Z" } as never;
    const work = renderCard({ ...localJudgment, kind: "work", workItemId: "work" });
    work.rerender(<LabCard node={{ ...localJudgment, kind: "work", workItemId: "work" }} item={item} selected focused={false} connecting={false} connectSourceAnchor={null} canResize={false} onSelect={() => undefined} onOpen={() => undefined} onBranch={() => undefined} onHide={() => undefined} onDelete={() => undefined} onEdit={() => undefined} onEditCommitted={() => undefined} onAnchorPointerDown={() => undefined} onAnchorActivate={() => undefined} onMenuOpened={() => undefined} onMenuOpenChange={() => undefined} onMeasure={() => undefined} onPointerDown={() => undefined} onFocus={() => undefined} onKeyDown={() => undefined} onResizeStart={() => undefined} onFit={() => undefined} onResizeKeyDown={() => undefined} onResizeKeyUp={() => undefined} frameChoices={[]} structured onMoveToFrame={() => undefined} />);
    expect(work.container.querySelector(".canvas-lab-context-title")).not.toBeNull();
    expect(work.container.querySelector(".canvas-lab-context-header")).not.toBeNull();
  });

  it("centres an off-screen new card and leaves a visible card alone", () => {
    expect(panToRevealNode({ x: 0, y: 0 }, 0.5, { ...localJudgment, x: 20, y: 20 }, { width: 800, height: 600 })).toEqual({ x: 0, y: 0 });
    expect(panToRevealNode({ x: 0, y: 0 }, 0.5, { ...localJudgment, x: 1800, y: 1300 }, { width: 800, height: 600 })).toEqual({ x: -558, y: -378 });
  });
});