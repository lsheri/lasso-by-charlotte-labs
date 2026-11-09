// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ANSWER_CARD_SIZE, ANSWER_ROLLED_HEIGHT, answerRolled } from "@/lib/answer-card";
import { WORKBOARD_ANSWER_ROLLED_HEIGHT, validWorkboardNodeGeometry } from "@/lib/canvas-lab-shared";

const card = readFileSync("src/components/canvas-lab/LabAnswerCard.tsx", "utf8");
const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");

describe("PIN-2: roll a pinned answer up to its title", () => {
  it("rolled is a saved height: the 60 px title row and first line, read as rolled up to 64 px", () => {
    expect(ANSWER_ROLLED_HEIGHT).toBe(60);
    expect(WORKBOARD_ANSWER_ROLLED_HEIGHT).toBeLessThanOrEqual(ANSWER_ROLLED_HEIGHT);
    expect(answerRolled(44)).toBe(true);
    expect(answerRolled(64)).toBe(true);
    expect(answerRolled(65)).toBe(false);
    expect(answerRolled(ANSWER_CARD_SIZE.height)).toBe(false);
  });
  it("the server accepts a rolled answer and still refuses other cards that short", () => {
    expect(validWorkboardNodeGeometry({ kind: "answer", h: 44 })).toBe(true);
    expect(validWorkboardNodeGeometry({ kind: "answer", h: 43 })).toBe(false);
    expect(validWorkboardNodeGeometry({ kind: "work_item", h: 44 })).toBe(false);
  });
  it("the page saves the height, undoes like a resize, and unrolls to the earlier height or the default", () => {
    expect(page).toMatch(/const height = rolled \? ANSWER_ROLLED_HEIGHT : unrolledHeights\.current\.get\(node\.id\) \?\? ANSWER_CARD_SIZE\.height;/);
    expect(page).toMatch(/void persistNodePatch\(node\.id, \{ h: height \}\);\s*record\(\{ action: "resize", kind: "card", targetId: node\.id, before, after \}\);/);
  });
  it("only who may arrange the board sees the roll button; rolled shows the title row and the first line", () => {
    expect(card).toMatch(/\{layoutEditable && onRoll && !editing \? \(/);
    expect(card).toMatch(/aria-label=\{rolled \? "Show the answer" : "Roll up to the title"\}/);
    expect(card).toMatch(/data-testid="answer-rolled-line"/);
    expect(page).toMatch(/layoutEditable=\{boardEditable\}[^\n]*onRoll=\{\(rolled\) => rollAnswer\(node, rolled\)\}/);
  });
});

describe("PIN-2: resize handles on a pinned answer", () => {
  it("four corner handles when focused, never while editing or rolled up", () => {
    expect(card).toMatch(/\{layoutEditable && focused && !editing && !rolled && onResizeStart \? \(\["nw", "ne", "se", "sw"\] as LabResizeCorner\[\]\)/);
    expect(card).toMatch(/className="canvas-lab-resize-handle"/);
  });
  it("they use the board's card resize path, pointer and keyboard", () => {
    expect(page).toMatch(/onResizeStart=\{\(corner, event\) => startResize\("card", node\.id, corner, \{ x: node\.x, y: node\.y, width: node\.width, height: node\.height \}, event\)\} onResizeKeyDown=\{\(corner, event\) => keyboardResize\("card", node\.id, corner,[^\n]*onRoll=/);
  });
});
