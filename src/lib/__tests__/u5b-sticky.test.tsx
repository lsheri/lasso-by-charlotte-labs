// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LabSticky } from "@/components/canvas-lab/LabSticky";
import { applyDurableBoard, deleteLocalNode, resizeLabRect, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { isWorkboardDecorationKind, parseWorkboardStickyBody, serializeWorkboardStickyBody, WORKBOARD_NODE_KINDS, type WorkboardDto, type WorkboardNodeInput } from "@/lib/canvas-lab-shared";
import { cardsInMarquee } from "@/components/canvas-lab/canvas-lab-marquee";
import { validateLinkNodeKinds, validNodeInput, validNodeUpdate } from "@/lib/canvas-lab.server";
import { guardWorkboardEvent } from "@/lib/workboard-event-allowlist";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

const body = { text: "check the 18% before Thursday", size: "body", weight: "regular", colour: "ink", fill: "yellow" } as const;
const input = (patch: Partial<WorkboardNodeInput> = {}): WorkboardNodeInput => ({ clientKey: "s1", frameKey: null, kind: "sticky", body: serializeWorkboardStickyBody(body), x: 0, y: 0, w: 200, h: 140, ...patch });

const sticky: LabNode = { id: "sticky:1", kind: "sticky", frame: null, title: "Sticky", summary: "hi", typeLabel: "sticky", ownership: "yours", textSize: "body", textWeight: "regular", textColour: "ink", stickyFill: "green", local: true, x: 10, y: 20, width: 200, height: 140 };

describe("unit 5b sticky", () => {
  it("is a known, never-a-source kind", () => {
    expect(WORKBOARD_NODE_KINDS).toContain("sticky");
    expect(isWorkboardDecorationKind("sticky")).toBe(true);
  });

  it("server accepts a plain sticky and refuses a linked one", () => {
    expect(validNodeInput(input())).toBeNull();
    expect(validNodeInput(input({ workItemId: "w1" }))).toMatch(/cannot reference/);
    expect(validNodeInput(input({ decisionId: "d1" }))).toMatch(/cannot reference/);
    expect(validNodeInput(input({ frameKey: "task:1" }))).toMatch(/only carry/);
    expect(validNodeInput(input({ judgmentType: "corrected_ai" }))).toMatch(/only carry/);
    expect(validNodeInput(input({ body: JSON.stringify({ ...body, fill: "orange" }) }))).toMatch(/Check the sticky/);
    expect(validNodeInput(input({ w: 119 }))).toMatch(/Sticky dimensions/);
    expect(validateLinkNodeKinds(["work_item", "sticky"])).toBe("A sticky cannot be connected.");
    expect(validNodeUpdate("sticky", { body: serializeWorkboardStickyBody({ ...body, fill: "green" }) })).toBeNull();
  });

  it("resize floors at 120x90", () => {
    const rect = resizeLabRect({ x: 0, y: 0, width: 200, height: 140 }, "se", { x: -500, y: -500 }, false, "sticky");
    expect([rect.width, rect.height]).toEqual([120, 90]);
  });

  it("colour change survives a round trip through the durable board", () => {
    const board = {
      id: "b", engagementId: "e", version: 1, frames: [], links: [], viewerProfileId: "p", canEditStructure: true, archivedContextFrame: null,
      nodes: [{ id: "n1", frameId: null, kind: "sticky", workItemId: null, decisionId: null, authorProfileId: "p", authorName: "Liam", title: "", body: serializeWorkboardStickyBody({ ...body, fill: "green" }), judgmentType: null, x: 5, y: 6, w: 260, h: 160, hidden: false, version: 2, referenceReadable: true }],
    } satisfies WorkboardDto;
    const model = applyDurableBoard({ frames: [], nodes: [] }, board);
    const node = model.nodes.find((entry) => entry.kind === "sticky");
    expect(node?.stickyFill).toBe("green");
    expect(node?.summary).toBe(body.text);
    expect([node?.width, node?.height, node?.x, node?.y]).toEqual([260, 160, 5, 6]);
    expect(parseWorkboardStickyBody(serializeWorkboardStickyBody({ ...body, fill: "pink" }))?.fill).toBe("pink");
  });

  it("deletes like any node", () => {
    const result = deleteLocalNode([sticky], [], [], sticky.id);
    expect(result.nodes).toHaveLength(0);
  });

  it("is never picked up as context by the marquee", () => {
    expect(cardsInMarquee({ x: 0, y: 0, width: 1000, height: 1000 }, [sticky])).not.toContain(sticky.id);
  });

  it("renders plain paper: no brand edge, no fold", () => {
    const noop = () => {};
    const { container } = render(<LabSticky node={sticky} selected editable layoutEditable onSelect={noop} onDragStart={noop} onResizeStart={noop} onResizeKeyDown={noop} onResizeKeyUp={noop} onChange={noop} onCommit={noop} onRemove={noop} />);
    expect(container.querySelector(".fold")).toBeNull();
    expect(container.querySelector("[data-brand-edge], .ledger-work-note")).toBeNull();
    expect(container.innerHTML).not.toMatch(/--brand-|border-left/);
    expect(container.querySelector("[data-fill='green']")).not.toBeNull();
  });

  it("the allowlist keeps kind sticky on node_created", () => {
    expect(guardWorkboardEvent("workboard.node_created", { kind: "sticky", judgment_type: "none" })).toEqual({ keep: true, dims: { kind: "sticky", judgment_type: "none" } });
  });

  describe("DRAG-1 the words move the sticky", () => {
    const noop = () => {};
    const renderSticky = (patch: Partial<LabNode>, props: { layoutEditable?: boolean; onDragStart?: () => void } = {}) => render(<LabSticky node={{ ...sticky, ...patch }} selected={false} editable layoutEditable={props.layoutEditable ?? true} onSelect={noop} onDragStart={props.onDragStart ?? noop} onResizeStart={noop} onResizeKeyDown={noop} onResizeKeyUp={noop} onChange={noop} onCommit={noop} onRemove={noop} />);

    it("pressing the read-only plain words calls onDragStart", () => {
      const onDragStart = vi.fn();
      const { getByLabelText } = renderSticky({}, { onDragStart });
      fireEvent.pointerDown(getByLabelText("Sticky words"), { button: 0 });
      expect(onDragStart).toHaveBeenCalledTimes(1);
    });

    it("pressing the read-only rich words calls onDragStart", () => {
      const onDragStart = vi.fn();
      const { container } = renderSticky({ html: "<p>hi</p>" }, { onDragStart });
      fireEvent.pointerDown(container.querySelector(".node-rich .rich-text, .node-rich")!, { button: 0 });
      expect(onDragStart).toHaveBeenCalledTimes(1);
    });

    it("with layoutEditable false the words do not start a drag and no edge strips render", () => {
      const onDragStart = vi.fn();
      const { getByLabelText, container } = renderSticky({}, { layoutEditable: false, onDragStart });
      fireEvent.pointerDown(getByLabelText("Sticky words"), { button: 0 });
      expect(onDragStart).not.toHaveBeenCalled();
      expect(container.querySelector("[data-edge]")).toBeNull();
    });

    it("with data-editing true a press does not start a drag", () => {
      const onDragStart = vi.fn();
      const { container } = renderSticky({}, { onDragStart });
      const section = container.querySelector("section")!;
      fireEvent.doubleClick(section);
      expect(section.getAttribute("data-editing")).toBe("true");
      fireEvent.pointerDown(section, { button: 0 });
      expect(onDragStart).not.toHaveBeenCalled();
    });

    it("press then double click on either face still enters editing", () => {
      for (const patch of [{}, { html: "<p>hi</p>" }]) {
        const onDragStart = vi.fn();
        const { container, unmount } = renderSticky(patch, { onDragStart });
        const face = container.querySelector("textarea, .node-rich")!;
        fireEvent.pointerDown(face, { button: 0 }); fireEvent.pointerUp(face); fireEvent.click(face);
        fireEvent.pointerDown(face, { button: 0 }); fireEvent.pointerUp(face); fireEvent.click(face);
        fireEvent.doubleClick(face);
        expect(onDragStart).toHaveBeenCalledTimes(2);
        expect(container.querySelector("section")!.getAttribute("data-editing")).toBe("true");
        unmount();
      }
    });
  });
});
