import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardFrameRenders, dragEndDecision, stageBounds, type LabFrame, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { isContextFrameId } from "@/lib/context-region";

const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
const shared = readFileSync("src/components/canvas-lab/SharedBoardView.tsx", "utf8");
const card = readFileSync("src/components/canvas-lab/LabCard.tsx", "utf8");

function kindOf(frame: LabFrame): string {
  if (isContextFrameId(frame.id)) return "context";
  if (frame.id === "foundation" || frame.id === "decisions" || frame.id === "outputs") return frame.id;
  return frame.id.startsWith("task:") ? "task" : "custom";
}
const f = (id: string, x: number, y: number, width = 300, height = 200): LabFrame => ({ id, name: id, x, y, width, height } as LabFrame);
const region = f("region:abc", 40, 40);
const task = f("task:t1", 400, 40);
const retired = [f("decisions", 2000, 1800), f("foundation", 2600, 40), f("outputs", 40, 2400)];
const node = { id: "n1", x: 100, y: 100, width: 240, height: 120, frame: "decisions" } as LabNode;
const drawn = (frames: LabFrame[]) => frames.filter((frame) => boardFrameRenders(kindOf(frame), true));

describe("GF3 retired frames leave the move list, drop prompt and framing", () => {
  it("the move list keeps regions and workstreams and drops every retired kind", () => {
    const choices = [region, task, ...retired].filter((frame) => !isContextFrameId(frame.id) && frame.id !== "trail" && boardFrameRenders(kindOf(frame), true)).map((frame) => frame.id);
    expect(choices).toEqual(["region:abc", "task:t1"]);
    const filter = 'boardFrames.filter((frame) => !isContextFrameId(frame.id) && frame.id !== "trail" && boardFrameRenders(frameKindOf(frame), true)).map((frame) => ({ id: frame.id, name: frame.name }))';
    expect(page.split(filter).length - 1).toBe(2);
    expect(page).not.toContain('boardFrames.filter((frame) => !isContextFrameId(frame.id) && frame.id !== "trail").map(');
  });

  it("stageBounds with a retired frame equals stageBounds without it", () => {
    expect(stageBounds(drawn([region, task, ...retired]), [node])).toEqual(stageBounds([region, task], [node]));
    expect(stageBounds([region, task, ...retired], [node])).not.toEqual(stageBounds([region, task], [node]));
  });

  it("stageBounds for a board with no retired frames is unchanged", () => {
    const ctx = f("context", 900, 900);
    for (const frames of [[], [region], [region, task, ctx]]) {
      expect(stageBounds(drawn(frames), [node])).toEqual(stageBounds(frames, [node]));
    }
  });

  it("board, fit and shared view bounds all go through the helper", () => {
    expect(page).toContain("const drawnBoardFrames = useMemo(() => boardFrames.filter((frame) => boardFrameRenders(frameKindOf(frame), true)), [boardFrames]);");
    expect(page).toContain("stageBounds(drawnBoardFrames, visibleNodes)");
    expect(page).toContain("fitInputsRef.current = { frames: drawnBoardFrames, nodes");
    expect(shared).toContain("stageBounds(model.frames.filter((frame) => boardFrameRenders(frameKindOf(frame), true)), model.nodes)");
  });

  it("dropping a card over a retired frame's area asks nothing", () => {
    const moved = { ...node, frame: null } as LabNode;
    const input = { origin: { x: 100, y: 100 }, from: { x: 0, y: 0 }, pointer: { x: 2000, y: 1800 }, zoom: 1, node: moved, mode: "structured" as const, editable: true };
    expect(dragEndDecision({ ...input, frames: [region, ...retired] }).promptFrameId).toBe("decisions");
    const decision = dragEndDecision({ ...input, frames: drawn([region, ...retired]) });
    expect(decision.promptFrameId).toBeNull();
    expect(decision.position).toEqual({ x: 2100, y: 1900 });
    expect(page).toContain("frames: framesRef.current.filter((frame) => boardFrameRenders(frameKindOf(frame), true)),");
  });

  it("a card linked to a retired frame still renders and still saves", () => {
    expect(page).toContain("const shownNodes = useMemo(() => allNodes.filter((node) => !hiddenIds.includes(node.id)), [allNodes, hiddenIds]);");
    expect(card).toContain("left: node.x, top: node.y");
    // Saves carry the card's own frame link and position, untouched by the helper.
    expect(page).toContain("const base = { clientKey: node.clientKey ?? node.id, frameKey: node.frame ?? null, x: node.x, y: node.y");
    expect(page).not.toMatch(/frameKey: [^,]*boardFrameRenders/);
  });
});
