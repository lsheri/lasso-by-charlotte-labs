import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardFrameRenders, RETIRED_GUIDE_FRAME_KINDS } from "@/components/canvas-lab/canvas-lab-model";

const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
const shared = readFileSync("src/components/canvas-lab/SharedBoardView.tsx", "utf8");
const card = readFileSync("src/components/canvas-lab/LabCard.tsx", "utf8");
const menu = readFileSync("src/components/canvas-lab/LabFrameMenu.tsx", "utf8");

describe("GF2 retired guide frames stop drawing", () => {
  it.each(["decisions", "foundation", "outputs"])("%s draws in neither structure mode", (kind) => {
    expect(boardFrameRenders(kind, true)).toBe(false);
    expect(boardFrameRenders(kind, false)).toBe(false);
  });

  it("context draws in both modes, drawn regions and workstreams only in structured mode, as before", () => {
    expect(boardFrameRenders("context", true)).toBe(true);
    expect(boardFrameRenders("context", false)).toBe(true);
    expect(boardFrameRenders("custom", true)).toBe(true);
    expect(boardFrameRenders("custom", false)).toBe(false);
    expect(boardFrameRenders("task", true)).toBe(true);
    expect(boardFrameRenders("task", false)).toBe(false);
    expect([...RETIRED_GUIDE_FRAME_KINDS].sort()).toEqual(["decisions", "foundation", "outputs"]);
  });

  it("the board's frame list goes through the helper, the trail stays excluded", () => {
    expect(page).toContain('boardFrames.filter((frame) => frame.id !== "trail" && boardFrameRenders(frameKindOf(frame), structureMode === "structured")).map(');
    expect(page).not.toContain('(structureMode === "structured" || frameKindOf(frame) === "context")).map(');
  });

  it("cards inside a retired frame still render at their own coordinates", () => {
    // Card lists come from visibleNodes, which never filters on frame membership.
    expect(page).toContain("const shownNodes = useMemo(() => allNodes.filter((node) => !hiddenIds.includes(node.id)), [allNodes, hiddenIds]);");
    expect(page).toMatch(/visibleNodes\.filter\(\(node\) => node\.kind !== "answer" && !isWorkboardDecorationKind\(node\.kind\)\)\.map\(\(node\) =>/);
    expect(page).not.toMatch(/visibleNodes\.filter\([^)]*boardFrameRenders/);
    // A card draws from its own x and y, not its frame's.
    expect(card).toContain("left: node.x, top: node.y");
  });

  it("a context frame keeps its menu, and a drawn region stays movable, renamable and deletable", () => {
    expect(page).toContain("onDragStart={region && lab.board?.canEditStructure ? (event) => startGroupingDrag(frame, event) : undefined}");
    expect(page).toContain('onRemove={() => kind === "context" ? void removeContextArea(frame) : removeFrame(frame)}');
    expect(page).toContain("onUseAsContext={() => useFrameAsContext(frame)}");
    expect(menu).toContain("Use as context");
    expect(menu).toContain("Fit contents");
  });

  it("the shared board view draws only context frames, so no retired frame", () => {
    expect(shared).toContain('model.frames.filter((frame) => frame.id !== "trail" && frameKindOf(frame) === "context")');
  });
});
