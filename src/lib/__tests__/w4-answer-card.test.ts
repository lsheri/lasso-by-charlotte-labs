import { describe, expect, it } from "vitest";

import {
  answerAsOf,
  answerCiteRows,
  answerNodeInput,
  answerReadWorkItemIds,
  orderedAnswerTurnIds,
} from "@/lib/answer-card";
import { WORKBOARD_NODE_KINDS } from "@/lib/canvas-lab-shared";
import { LAB_TEMPLATE_KINDS } from "@/components/canvas-lab/canvas-lab-model";

const READS = [
  { id: "work-a", depth: "full", title: "Pricing thread with the client" },
  { id: "work-b", depth: "extract", title: "Margin model v3" },
  { id: "work-a", depth: "extract", title: "Pricing thread with the client" },
];

const TURNS = [
  { id: "turn-a2", work_item_id: "work-a", turn_no: 2 },
  { id: "turn-b1", work_item_id: "work-b", turn_no: 1 },
  { id: "turn-a1", work_item_id: "work-a", turn_no: 1 },
];

describe("an answer kept as a card", () => {
  it("records stored turn references and no prose about its sources", () => {
    const workIds = answerReadWorkItemIds(READS);
    const turnIds = orderedAnswerTurnIds(workIds, TURNS);
    const rows = answerCiteRows("node-1", turnIds);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["node_id", "ord", "turn_id"]);
      expect(TURNS.some((turn) => turn.id === row.turn_id)).toBe(true);
    }
    expect(rows.map((row) => row.ord)).toEqual(rows.map((_row, index) => index));

    const stored = JSON.stringify(rows);
    for (const read of READS) expect(stored).not.toContain(read.title);

    const input = answerNodeInput({ clientKey: "k", at: { x: 10, y: 20 }, text: "The answer body." });
    const prose = JSON.stringify(input);
    for (const read of READS) expect(prose).not.toContain(read.title);
    expect(input.body).toBe("The answer body.");
    expect(input.workItemId ?? null).toBeNull();
    expect(input.decisionId ?? null).toBeNull();
  });

  it("shows an as-of date derived from the saved row", () => {
    const createdAt = "2026-03-04T09:30:00.000Z";
    const at = new Date(createdAt);
    expect(answerAsOf(createdAt)).toBe(
      at.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
    );
    expect(answerAsOf(null)).toBe("");

    const other = new Date("2027-11-19T09:30:00.000Z");
    expect(answerAsOf(other.toISOString())).not.toBe(answerAsOf(createdAt));
  });

  it("is a saved kind but never a card anyone can create", () => {
    expect(WORKBOARD_NODE_KINDS).toContain("answer");
    expect(LAB_TEMPLATE_KINDS as readonly string[]).not.toContain("answer");
  });
});
