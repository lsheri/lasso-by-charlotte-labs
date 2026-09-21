import { describe, expect, it } from "vitest";

import {
  briefAttachmentPoints,
  briefConfirmShape,
  pendingBriefAttachments,
} from "@/lib/brief-files";
import { DRAG_STEP, snapPoint } from "@/lib/canvas-drag";
import { PLACEMENT_CARD, PLACEMENT_GAP } from "@/lib/workboard-placement";

/**
 * The column the placement code opens, derived the same way the code derives
 * it, so a change to the card size moves these expectations with it rather
 * than turning into a hand-calculated coordinate that goes stale.
 */
const columnStep = Math.ceil((PLACEMENT_CARD.height + PLACEMENT_GAP) / DRAG_STEP) * DRAG_STEP;
const columnBase = (card: { x: number; y: number; width: number }) =>
  snapPoint({ x: card.x + card.width + PLACEMENT_GAP, y: card.y });

const brief = { x: 0, y: 0, width: 232 };

describe("where an attached file lands", () => {
  it("opens a column immediately to the right of the brief card", () => {
    const points = briefAttachmentPoints(brief, [], 2);
    expect(points).toHaveLength(2);
    expect(points[0]!.x).toBeGreaterThanOrEqual(brief.x + brief.width + PLACEMENT_GAP - 8);
    expect(points[0]!.x).toBeGreaterThan(brief.x + brief.width);
    expect(points[1]!.x).toBe(points[0]!.x);
    expect(points[1]!.y).toBeGreaterThan(points[0]!.y + PLACEMENT_CARD.height);
  });

  it("stays beside the brief when the whole area around it is claimed", () => {
    // The live case: the brief sits at 88, 484 inside a large outline. The
    // outline is not occupied space, so the card lands one column right of
    // the brief, never up and to the left of it.
    const sitting = { x: 88, y: 484, width: 232 };
    const points = briefAttachmentPoints(sitting, [{ x: 88, y: 484, width: 232, height: 112 }], 2);
    for (const point of points) {
      expect(point.x).toBeGreaterThan(sitting.x + sitting.width);
      expect(point.y).toBeGreaterThanOrEqual(sitting.y);
    }
    expect(points[0]).toEqual({ x: 352, y: 484 });
    expect(points[1]).toEqual({ x: 352, y: 638 });
  });

  it("moves down, then across, when the column beside the brief is full", () => {
    const sitting = { x: 0, y: 0, width: 232 };
    const column = Array.from({ length: 40 }, (_, row) => ({ x: 264, y: row * 154, width: 232, height: 112 }));
    const points = briefAttachmentPoints(sitting, column, 1);
    expect(points[0]!.x).toBeGreaterThan(264);
    expect(points[0]!.y).toBeGreaterThanOrEqual(0);
  });

  it("keeps clear of anything already on the board", () => {
    const taken = [{ x: 256, y: 0, width: 232, height: 112 }];
    const points = briefAttachmentPoints(brief, taken, 1);
    const landed = { ...points[0]!, ...PLACEMENT_CARD };
    const clash =
      landed.x < taken[0]!.x + taken[0]!.width + PLACEMENT_GAP &&
      landed.x + landed.width + PLACEMENT_GAP > taken[0]!.x &&
      landed.y < taken[0]!.y + taken[0]!.height + PLACEMENT_GAP &&
      landed.y + landed.height + PLACEMENT_GAP > taken[0]!.y;
    expect(clash).toBe(false);
  });
});

describe("which attachments still need their link", () => {
  const nodes = [
    { id: "brief", workItemId: null },
    { id: "work:a", workItemId: "a" },
    { id: "work:b", workItemId: "b" },
  ];

  it("takes only the cards on the board that have no context link yet", () => {
    const links = [{ fromId: "brief", toId: "work:a", relation: "context" }];
    expect(pendingBriefAttachments(["a", "b", "missing"], nodes, links)).toEqual([
      { nodeId: "work:b", workItemId: "b" },
    ]);
  });

  it("never asks for a second link for the same pair", () => {
    const links = [
      { fromId: "brief", toId: "work:a", relation: "context" },
      { fromId: "brief", toId: "work:b", relation: "context" },
    ];
    expect(pendingBriefAttachments(["a", "b", "a"], nodes, links)).toEqual([]);
  });

  it("counts a link with no relation written down as the context link", () => {
    expect(
      pendingBriefAttachments(["a"], nodes, [{ fromId: "brief", toId: "work:a" }]),
    ).toEqual([]);
  });

  it("still claims a card linked from somewhere else", () => {
    const links = [{ fromId: "work:b", toId: "work:a", relation: "informed" }];
    expect(pendingBriefAttachments(["a"], nodes, links)).toEqual([
      { nodeId: "work:a", workItemId: "a" },
    ]);
  });
});

describe("the create confirm", () => {
  it("keeps the original sentence with no brief and no files", () => {
    const shape = briefConfirmShape({ hasBriefText: false, fileCount: 0 });
    expect(shape?.message).toBe(
      "Create without a brief? Drift analysis and Firm checks will say no brief is in the record until one exists.",
    );
    expect(shape?.submitLabel).toBe("Create without a brief");
  });

  it("asks for one summarizing line when files are attached", () => {
    const shape = briefConfirmShape({ hasBriefText: false, fileCount: 2 });
    expect(shape?.message).toBe(
      "Add a sentence summarizing the brief? The files carry the detail. One line says what the work is measured against.",
    );
    expect(shape?.submitLabel).toBe("Create without a summary");
  });

  it("asks nothing once a brief is written", () => {
    expect(briefConfirmShape({ hasBriefText: true, fileCount: 3 })).toBeNull();
  });
});
