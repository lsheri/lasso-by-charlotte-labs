import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { boardSelectionScope } from "@/lib/reflect-scope-shape";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const page = read("src/pages/CanvasLabPage.tsx");
const boardAsk = read("src/components/canvas-lab/BoardAsk.tsx");

describe("B2 one chat on the board", () => {
  it("no longer renders WorkRail or ContextComposer from the board", () => {
    expect(page).not.toMatch(/<WorkRail\b/);
    expect(page).not.toMatch(/<ContextComposer\b/);
    expect(page).not.toMatch(/import \{ WorkRail \}/);
    expect(page).not.toContain("createChatNode(");
    expect(page).not.toContain("canvasInstructions");
  });

  it("renders none of the six suggestion chips from board files", () => {
    const chips = ["Find tension", "Challenge this recommendation", "What is still an assumption?", "What would a principal ask?", "Draft a decision", "Trace a number"];
    for (const text of [page, boardAsk]) for (const chip of chips) expect(text).not.toContain(chip);
  });

  it("feeds the board selection into Ask Lasso", () => {
    expect(boardAsk).toContain("boardContextItemIds: string[]");
    expect(boardAsk).toContain("ask.setBoardSelection(");
    expect(page).toContain("boardContextItemIds={");
  });

  it("keeps the complete board scope matrix narrow", () => {
    expect(boardSelectionScope({ engagementId: "e", hasBoardPicks: false, mappedIds: [] })).toEqual({ mode: "engagements", ids: ["e"] });
    expect(boardSelectionScope({ engagementId: "e", hasBoardPicks: true, mappedIds: ["a"] })).toEqual({ mode: "items", ids: ["a"] });
    expect(boardSelectionScope({ engagementId: "e", hasBoardPicks: true, mappedIds: ["a", "b", "c", "d"] })).toEqual({ mode: "items", ids: ["a", "b", "c", "d"] });
    expect(boardSelectionScope({ engagementId: "e", hasBoardPicks: true, mappedIds: [] })).toEqual({ mode: "engagements", ids: ["e"] });
  });

  it("keeps the live board pick through New chat and restores all work only after clear", () => {
    expect(boardAsk).toContain("props.boardContextHasPicks");
    expect(page).toContain("boardContextHasPicks={contextNodes.length > 0}");
    const hook = read("src/components/reflect/use-ask-lasso.ts");
    expect(hook).toContain("boardSelection.active ? boardSelection.ids : mapped.map");
    expect(hook).toContain('setScopeSource(hasPicks ? (ids.length > 0 ? "board_pick" : "board_pick_brief_only") : "all")');
  });

  it("keeps removed cards reachable from the board menu", () => {
    expect(page).toContain("Put back on the board (");
    expect(page).toMatch(/restoreNode\(node\.id\)/);
  });
});
