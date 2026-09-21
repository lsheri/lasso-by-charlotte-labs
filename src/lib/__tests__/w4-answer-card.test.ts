import { describe, expect, it } from "vitest";

import { answerAsOf, answerCiteRows, answerNodeInput } from "@/lib/answer-card";
import { regionClaimable } from "@/lib/board-region";
import { WORKBOARD_NODE_KINDS } from "@/lib/canvas-lab-shared";
import { LAB_TEMPLATE_KINDS } from "@/components/canvas-lab/canvas-lab-model";

const READS = [
  { id: "work-a", depth: "full", title: "Cure First Problem Definition.pdf" },
  { id: "work-b", depth: "extract", title: "Margin model v3" },
  { id: "work-c", depth: "catalogue", title: "Board pack index" },
  { id: "work-d", depth: "unreadable", title: "Scanned fax" },
  { id: "work-a", depth: "extract", title: "Cure First Problem Definition.pdf" },
];

describe("an answer kept as a card", () => {
  it("records the sources it read, in read order, at the depth it read them", () => {
    const rows = answerCiteRows("node-1", READS);
    const readable = READS.filter((read) => read.depth === "full" || read.depth === "extract");
    const distinct = readable.filter((read, index) => readable.findIndex((other) => other.id === read.id) === index);

    expect(rows.map((row) => row.work_item_id)).toEqual(distinct.map((read) => read.id));
    expect(rows.map((row) => row.depth)).toEqual(distinct.map((read) => read.depth));
    expect(rows.map((row) => row.ord)).toEqual(rows.map((_row, index) => index));
    for (const row of rows) {
      expect(row.turn_id).toBeNull();
      expect(row.node_id).toBe("node-1");
    }
  });

  it("carries no source title or file name, on the rows or on the card", () => {
    const stored = JSON.stringify(answerCiteRows("node-1", READS));
    const input = answerNodeInput({ clientKey: "k", at: { x: 10, y: 20 }, text: "The answer body." });
    const prose = JSON.stringify(input);
    for (const read of READS) {
      expect(stored).not.toContain(read.title);
      expect(prose).not.toContain(read.title);
    }
    expect(input.body).toBe("The answer body.");
    expect(input.workItemId ?? null).toBeNull();
    expect(input.decisionId ?? null).toBeNull();
  });

  it("cites nothing for a listing", () => {
    expect(answerCiteRows("node-1", [{ id: "work-c", depth: "catalogue" }])).toEqual([]);
    expect(answerCiteRows("node-1", [{ id: "work-d", depth: "unreadable" }])).toEqual([]);
    expect(answerCiteRows("node-1", [{ id: "work-e", depth: "skimmed" }])).toEqual([]);
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

  it("carries the workstream it is kept into, and stays freeform without one", () => {
    const placed = answerNodeInput({ clientKey: "k", at: { x: 10, y: 20 }, text: "The answer body.", frameKey: "region:abc" });
    expect(placed.frameKey).toBe("region:abc");
    expect(placed.kind).toBe("answer");
    const free = answerNodeInput({ clientKey: "k", at: { x: 10, y: 20 }, text: "The answer body." });
    expect(free.frameKey).toBeNull();
  });

  it("is never excluded from what a named region can claim", () => {
    expect(regionClaimable("answer")).toBe(true);
  });

  it("is a saved kind but never a card anyone can create", () => {
    expect(WORKBOARD_NODE_KINDS).toContain("answer");
    expect(LAB_TEMPLATE_KINDS as readonly string[]).not.toContain("answer");
  });
});
