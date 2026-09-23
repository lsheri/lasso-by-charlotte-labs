import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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
    expect(boardAsk).toContain("ask.setSelected(");
    expect(page).toContain("boardContextItemIds={");
  });

  it("keeps removed cards reachable from the board menu", () => {
    expect(page).toContain("Put back on the board (");
    expect(page).toMatch(/restoreNode\(node\.id\)/);
  });
});
