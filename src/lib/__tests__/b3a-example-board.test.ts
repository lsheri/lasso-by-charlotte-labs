import { describe, expect, it } from "vitest";

import { EXAMPLE_LINKS, EXAMPLE_NODES } from "@/components/canvas-lab/example-board";
import { WORKBOARD_EVENT_DIMS } from "@/lib/workboard-event-allowlist";
import { boardIsNearEmpty, readWorkboardStructureMode, workboardStructureModeKey } from "@/lib/workboard-view-mode";

describe("stored outline choice", () => {
  it("falls back to freeform when nothing is stored", () => {
    expect(readWorkboardStructureMode(null)).toBe("freeform");
    expect(readWorkboardStructureMode(undefined)).toBe("freeform");
  });

  it("uses the stored value when there is one", () => {
    expect(readWorkboardStructureMode("structured")).toBe("structured");
    expect(readWorkboardStructureMode("freeform")).toBe("freeform");
  });

  it("falls back on a value it does not recognise", () => {
    expect(readWorkboardStructureMode("Structured")).toBe("freeform");
    expect(readWorkboardStructureMode("")).toBe("freeform");
    expect(readWorkboardStructureMode("{}")).toBe("freeform");
  });

  it("keys the choice by viewer and board", () => {
    expect(workboardStructureModeKey("p1", "e1")).toBe("lasso:workboard:p1:e1:structure");
    expect(workboardStructureModeKey("p1", "e1")).not.toBe(workboardStructureModeKey("p2", "e1"));
  });
});

describe("near-empty rule", () => {
  const card = (kind: string) => ({ kind });

  it("offers the example on an empty board and a brief-only board", () => {
    expect(boardIsNearEmpty([])).toBe(true);
    expect(boardIsNearEmpty([card("brief")])).toBe(true);
  });

  it("still offers it with two cards beside the brief", () => {
    expect(boardIsNearEmpty([card("brief"), card("work"), card("decision")])).toBe(true);
  });

  it("hides it once three cards are on the board", () => {
    expect(boardIsNearEmpty([card("brief"), card("work"), card("decision"), card("judgment")])).toBe(false);
    expect(boardIsNearEmpty([card("work"), card("work"), card("work")])).toBe(false);
  });
});

describe("the sample board itself", () => {
  it("has no overlapping cards", () => {
    for (let i = 0; i < EXAMPLE_NODES.length; i += 1) {
      for (let j = i + 1; j < EXAMPLE_NODES.length; j += 1) {
        const a = EXAMPLE_NODES[i]!;
        const b = EXAMPLE_NODES[j]!;
        const overlaps = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it("points every link at a card that exists", () => {
    const ids = new Set(EXAMPLE_NODES.map((node) => node.id));
    for (const link of EXAMPLE_LINKS) {
      expect(ids.has(link.fromId), link.id).toBe(true);
      expect(ids.has(link.toId), link.id).toBe(true);
      expect(link.fromId).not.toBe(link.toId);
    }
  });

  it("carries only relation labels the product already uses", () => {
    for (const link of EXAMPLE_LINKS) {
      expect(["informed", "produced", "revised", "cited", "context"]).toContain(link.relation);
    }
  });
});

describe("telemetry registration", () => {
  it("allows the example event with its one dimension", () => {
    expect(WORKBOARD_EVENT_DIMS["workboard.example_viewed"]).toEqual(["via"]);
  });
});
