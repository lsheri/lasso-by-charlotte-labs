import { describe, expect, it } from "vitest";

import { inboundLabNodeIds, type LabLink, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { validateLinkNodeKinds, validNodeInput, validNodeUpdate } from "@/lib/canvas-lab.server";
import { WORKBOARD_NODE_KINDS, isWorkboardDecorationKind, type WorkboardNodeInput, type WorkboardNodeKind } from "@/lib/canvas-lab-shared";
import { placementRectsForNodes } from "@/lib/workboard-placement";

describe("C2.1 decoration boundary", () => {
  it("deliberately keeps mark creation closed until marker behavior exists", () => {
    const mark: WorkboardNodeInput = {
      clientKey: "mark:future",
      frameKey: null,
      kind: "mark",
      body: "unvalidated",
      x: 0,
      y: 0,
      w: 260,
      h: 180,
    };

    expect(validNodeInput(mark)).toBe("Marks are not available yet.");
    expect(validNodeUpdate("mark", { body: "still unvalidated" })).toBe("Marks are not available yet.");
  });

  it("keeps every vocabulary kind on the same side of all decoration filters", () => {
    const expectedByKind = {
      brief: false,
      work_item: false,
      decision: false,
      judgment: false,
      draft: false,
      shape: true,
      text: true,
      mark: true,
      answer: false,
      sticky: true,
    } satisfies Record<WorkboardNodeKind, boolean>;

    for (const kind of WORKBOARD_NODE_KINDS) {
      const decoration = expectedByKind[kind];
      const nodes = [
        { id: "candidate", kind, x: 0, y: 0, width: 260, height: 180 },
        { id: "anchor", kind: "work", x: 400, y: 0, width: 260, height: 180 },
      ] as LabNode[];
      const links = [{ id: "link", fromId: "candidate", toId: "anchor", fromAnchor: "right", toAnchor: "left" }] as LabLink[];

      expect(isWorkboardDecorationKind(kind)).toBe(decoration);
      expect(validateLinkNodeKinds([kind, "work_item"]) !== null).toBe(decoration);
      expect(placementRectsForNodes(nodes).some((rect) => rect.x === 0)).toBe(!decoration);
      expect(inboundLabNodeIds(nodes, links, "anchor").has("candidate")).toBe(!decoration);
    }
  });
});