import { describe, expect, it } from "vitest";

import {
  WORKBOARD_SHAPE_COLOURS,
  validWorkboardNodeGeometry,
  type WorkboardNodeInput,
  type WorkboardNodeKind,
} from "@/lib/canvas-lab-shared";
import { validateLinkNodeKinds, validNodeInput } from "@/lib/canvas-lab.server";
import { applyDurableBoard, inboundLabNodeIds, shapePointerIntent, type LabLink, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
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
  it("keeps the client vocabulary aligned with the durable record", () => {
    const kinds: WorkboardNodeKind[] = ["shape", "text", "mark"];
    expect(kinds).toEqual(["shape", "text", "mark"]);
  });

  it("accepts a large colour block but keeps the card range unchanged", () => {
    expect(validWorkboardNodeGeometry({ kind: "shape", w: 1200, h: 900 })).toBe(true);
    expect(validWorkboardNodeGeometry({ kind: "work_item", w: 1200, h: 900 })).toBe(false);
  });

  it("accepts only closed palette tokens for colour blocks", () => {
    expect(WORKBOARD_SHAPE_COLOURS).toContain("green");
    expect(validNodeInput(input())).toBeNull();
    expect(validNodeInput(input({ body: "#00ff00" }))).toBe("Choose one of the available block colours.");
  });

  it("refuses references and unknown kinds before the record does", () => {
    expect(validNodeInput(input({ workItemId: "work-1" }))).toBe("A colour block cannot reference work or a decision.");
    expect(validNodeInput({ ...input(), kind: "unknown" as WorkboardNodeKind })).toBe("Unknown workboard item kind.");
  });

  it("refuses a relationship with a colour block at either end", () => {
    expect(validateLinkNodeKinds(["shape", "work_item"])).toBe("A colour block cannot be connected.");
    expect(validateLinkNodeKinds(["work_item", "decision"])).toBeNull();
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
    expect(shapePointerIntent({ selected: false, onEdge: false })).toBe("pan");
    expect(shapePointerIntent({ selected: false, onEdge: true })).toBe("drag");
    expect(shapePointerIntent({ selected: true, onEdge: false })).toBe("drag");
  });

  it("does not reserve placement space for colour blocks", () => {
    const nodes = [
      { id: "shape", kind: "shape", x: 0, y: 0, width: 1200, height: 900 },
      { id: "card", kind: "work", x: 300, y: 0, width: 260, height: 180 },
    ] as LabNode[];
    expect(placementRectsForNodes(nodes)).toEqual([{ x: 300, y: 0, width: 260, height: 180 }]);
  });
});
