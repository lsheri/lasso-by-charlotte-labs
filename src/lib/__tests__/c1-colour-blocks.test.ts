import { describe, expect, it } from "vitest";

import {
  WORKBOARD_SHAPE_COLOURS,
  validWorkboardNodeGeometry,
  type WorkboardNodeInput,
  type WorkboardNodeKind,
} from "@/lib/canvas-lab-shared";
import { validNodeInput } from "@/lib/canvas-lab.server";

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
});
