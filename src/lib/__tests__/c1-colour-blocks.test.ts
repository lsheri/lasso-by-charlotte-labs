import { describe, expect, it } from "vitest";

import {
  WORKBOARD_NODE_KINDS,
  WORKBOARD_SHAPE_COLOURS,
  validWorkboardNodeGeometry,
  type WorkboardNodeInput,
} from "@/lib/canvas-lab-shared";
import { validateLinkNodeKinds, validNodeInput } from "@/lib/canvas-lab.server";
import { applyDurableBoard, decorationPointerIntent, inboundLabNodeIds, resizeLabRect, type LabLink, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { placementRectsForNodes } from "@/lib/workboard-placement";

function input(overrides: Partial<WorkboardNodeInput> = {}): WorkboardNodeInput {
  return {
    clientKey: "shape:test",
    frameKey: null,
    kind: "shape",
    body: "green",
    x: 0,
    y: 0,
    w: 1200,
    h: 900,
    ...overrides,
  };
}

describe("C1 colour block vocabulary and validation", () => {
  it("accepts every implemented node kind, deliberately keeps marks closed, and refuses an unknown kind", () => {
    const validByKind = {
      brief: input({ kind: "brief", body: "", w: 260, h: 180 }),
      work_item: input({ kind: "work_item", body: "", workItemId: "work-1", w: 260, h: 180 }),
      decision: input({ kind: "decision", body: "", decisionId: "decision-1", w: 260, h: 180 }),
      judgment: input({ kind: "judgment", body: "", w: 260, h: 180 }),
      draft: input({ kind: "draft", body: "", w: 260, h: 180 }),
      shape: input(),
      text: input({ kind: "text", body: JSON.stringify({ text: "Intake", size: "label", weight: "medium", colour: "green" }), w: 260, h: 80 }),
      mark: input({ kind: "mark", body: "", w: 260, h: 180 }),
      answer: input({ kind: "answer", body: "The answer body.", w: 320, h: 240 }),
      sticky: input({ kind: "sticky", body: JSON.stringify({ text: "Note", size: "body", weight: "regular", colour: "ink", fill: "yellow" }), w: 200, h: 140 }),
    } satisfies Record<(typeof WORKBOARD_NODE_KINDS)[number], WorkboardNodeInput>;

    for (const kind of WORKBOARD_NODE_KINDS) {
      expect(validNodeInput(validByKind[kind])).toBe(kind === "mark" ? "Marks are not available yet." : null);
      // W3 retired the colour block: a region is a frame, so the write path is closed.
    }
    expect(validNodeInput({ ...input(), kind: "unknown" as WorkboardNodeInput["kind"] })).toBe("Unknown workboard item kind.");
  });

  it("accepts a large colour block but keeps the card range unchanged", () => {
    expect(validWorkboardNodeGeometry({ kind: "shape", w: 1200, h: 900 })).toBe(true);
    expect(validWorkboardNodeGeometry({ kind: "work_item", w: 1200, h: 900 })).toBe(false);
  });

  it("keeps the colour block write path closed on purpose, the way marks are closed", () => {
    expect(WORKBOARD_NODE_KINDS).not.toContain("shape");
    expect(validNodeInput(input())).toBe("Unknown workboard item kind.");
    expect(validNodeInput(input({ body: "#00ff00" }))).toBe("Unknown workboard item kind.");
  });

  it("refuses references and unknown kinds before the record does", () => {
    expect(validNodeInput(input({ workItemId: "work-1" }))).toBe("Unknown workboard item kind.");
    expect(validNodeInput({ ...input(), kind: "unknown" as WorkboardNodeInput["kind"] })).toBe("Unknown workboard item kind.");
  });

  it("refuses relationships with every decorative node kind", () => {
    expect(validateLinkNodeKinds(["shape", "work_item"])).toBe("A colour block cannot be connected.");
    expect(validateLinkNodeKinds(["work_item", "text"])).toBe("A text block cannot be connected.");
    expect(validateLinkNodeKinds(["mark", "decision"])).toBe("A mark cannot be connected.");
    expect(validateLinkNodeKinds(["work_item", "decision"])).toBeNull();
  });

  it("keeps large block dimensions through the resize path", () => {
    expect(resizeLabRect(
      { x: 0, y: 0, width: 420, height: 280 },
      "se",
      { x: 780, y: 620 },
      false,
      "shape",
    )).toMatchObject({ width: 1200, height: 900 });
  });
});

describe("C1 colour block record and board behavior", () => {
  const shapeDto = {
    id: "shape-1", frameId: null, kind: "shape" as const, workItemId: null, decisionId: null,
    authorProfileId: "teammate", authorName: "Lee", title: "", body: "green", judgmentType: null,
    x: 40, y: 80, w: 1200, h: 900, hidden: false, version: 2, referenceReadable: true,
  };

  it("rehydrates a saved colour block with its token and attribution", () => {
    const merged = applyDurableBoard({ frames: [], nodes: [] }, {
      id: "board-1", engagementId: "eng-1", version: 1, frames: [], nodes: [shapeDto], links: [],
      viewerProfileId: "me", canEditStructure: true, archivedContextFrame: null,
    });
    expect(merged.nodes[0]).toMatchObject({ kind: "shape", colour: "green", ownership: "teammate", width: 1200, height: 900 });
  });

  it("keeps colour blocks out of the inbound walk even with an old malformed relationship", () => {
    const nodes = [{ id: "shape", kind: "shape" }, { id: "card", kind: "work" }] as LabNode[];
    const links = [{ id: "link", fromId: "shape", toId: "card", fromAnchor: "right", toAnchor: "left" }] as LabLink[];
    expect([...inboundLabNodeIds(nodes, links, "card")]).toEqual(["card"]);
  });

  it("routes pointer presses according to block selection and edge position", () => {
    expect(decorationPointerIntent({ selected: false, onEdge: false })).toBe("pan");
    expect(decorationPointerIntent({ selected: false, onEdge: true })).toBe("drag");
    expect(decorationPointerIntent({ selected: true, onEdge: false })).toBe("drag");
  });

  it("does not reserve placement space for colour blocks", () => {
    const nodes = [
      { id: "shape", kind: "shape", x: 0, y: 0, width: 1200, height: 900 },
      { id: "card", kind: "work", x: 300, y: 0, width: 260, height: 180 },
    ] as LabNode[];
    expect(placementRectsForNodes(nodes)).toEqual([{ x: 300, y: 0, width: 260, height: 180 }]);
  });
});
