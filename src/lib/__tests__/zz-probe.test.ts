import { describe, expect, it } from "vitest";
import { applyDurableBoard } from "@/components/canvas-lab/canvas-lab-model";
import { isContextFrameId } from "@/lib/context-region";

describe("probe", () => {
  it("keeps the context key on reload", () => {
    const merged = applyDurableBoard({ frames: [], nodes: [] }, {
      id: "b1", version: 1, canEditStructure: true,
      frames: [{ id: "f-uuid", key: "context", kind: "context", label: "Context", x: -22, y: -66, w: 536, h: 220, ord: 0, version: 2, taskId: null }],
      nodes: [], links: [],
    } as never);
    console.log(merged.frames.map((f) => ({ id: f.id, v: f.durableVersion })));
    expect(isContextFrameId(merged.frames[0]!.id)).toBe(true);
  });
});
