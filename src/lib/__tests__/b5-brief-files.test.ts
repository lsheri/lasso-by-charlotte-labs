import { describe, expect, it } from "vitest";

import {
  briefAttachmentPoints,
  briefConfirmShape,
  pendingBriefAttachments,
} from "@/lib/brief-files";
import { PLACEMENT_CARD, PLACEMENT_GAP } from "@/lib/workboard-placement";

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
