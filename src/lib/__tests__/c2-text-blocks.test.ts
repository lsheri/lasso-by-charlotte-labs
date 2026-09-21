import { describe, expect, it } from "vitest";

import { applyDurableBoard, decorationPointerIntent, inboundLabNodeIds, resizeLabRect, type LabLink, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { validNodeInput, validateLinkNodeKinds } from "@/lib/canvas-lab.server";
import { parseWorkboardTextBody, serializeWorkboardTextBody, validWorkboardNodeGeometry, type WorkboardNodeInput, type WorkboardTextBody } from "@/lib/canvas-lab-shared";
import { placementRectsForNodes } from "@/lib/workboard-placement";

const body: WorkboardTextBody = { text: "Intake", size: "heading", weight: "bold", colour: "green" };
const input = (overrides: Partial<WorkboardNodeInput> = {}): WorkboardNodeInput => ({ clientKey: "text-1", frameKey: null, kind: "text", body: serializeWorkboardTextBody(body), x: 0, y: 0, w: 260, h: 80, ...overrides });

describe("C2 text block record", () => {
  it("accepts exactly the four closed body fields, including empty words", () => {
    expect(validNodeInput(input())).toBeNull();
    expect(validNodeInput(input({ body: serializeWorkboardTextBody({ ...body, text: "" }) }))).toBeNull();
    expect(parseWorkboardTextBody(JSON.stringify({ ...body, extra: true }))).toBeNull();
    expect(validNodeInput(input({ body: "not json" }))).toBe("Check the text block words and style choices.");
    expect(validNodeInput(input({ body: JSON.stringify({ ...body, size: "giant" }) }))).toBe("Check the text block words and style choices.");
    expect(validNodeInput(input({ body: JSON.stringify({ ...body, weight: "heavy" }) }))).toBe("Check the text block words and style choices.");
    expect(validNodeInput(input({ body: JSON.stringify({ ...body, colour: "white" }) }))).toBe("Check the text block words and style choices.");
    expect(validNodeInput(input({ body: JSON.stringify({ ...body, text: "x".repeat(501) }) }))).toBe("Check the text block words and style choices.");
  });

  it("refuses card fields and accepts the text geometry range", () => {
    expect(validNodeInput(input({ frameKey: "frame" }))).toBe("A text block can only carry its words, style and rectangle.");
    expect(validNodeInput(input({ workItemId: "work" }))).toBe("A text block cannot reference work or a decision.");
    expect(validWorkboardNodeGeometry({ kind: "text", w: 80, h: 24 })).toBe(true);
    expect(validWorkboardNodeGeometry({ kind: "text", w: 4001, h: 24 })).toBe(false);
  });

  it("round trips words and style without card clamping", () => {
    const dto = { id: "text-row", frameId: null, kind: "text" as const, workItemId: null, decisionId: null, authorProfileId: "me", authorName: "Liam", title: "", body: serializeWorkboardTextBody(body), judgmentType: null, x: 0, y: 0, w: 1200, h: 900, hidden: false, version: 1, referenceReadable: true };
    const merged = applyDurableBoard({ frames: [], nodes: [] }, { id: "board", engagementId: "eng", version: 1, frames: [], nodes: [dto], links: [], viewerProfileId: "me", canEditStructure: true, archivedContextFrame: null });
    expect(merged.nodes[0]).toMatchObject({ kind: "text", summary: "Intake", textSize: "heading", textWeight: "bold", textColour: "green", width: 1200, height: 900 });
    expect(resizeLabRect({ x: 0, y: 0, width: 260, height: 80 }, "se", { x: 940, y: 820 }, false, "text")).toMatchObject({ width: 1200, height: 900 });
  });
});

describe("C2 text block decoration behavior", () => {
  it("refuses relationships and skips malformed inbound relationships", () => {
    expect(validateLinkNodeKinds(["work_item", "text"])).toBe("A text block cannot be connected.");
    const nodes = [{ id: "text", kind: "text" }, { id: "card", kind: "work" }] as LabNode[];
    const links = [{ id: "link", fromId: "text", toId: "card", fromAnchor: "right", toAnchor: "left" }] as LabLink[];
    expect([...inboundLabNodeIds(nodes, links, "card")]).toEqual(["card"]);
  });

  it("uses shared decoration pointer behavior and reserves no placement space", () => {
    expect(decorationPointerIntent({ selected: false, onEdge: false })).toBe("pan");
    expect(decorationPointerIntent({ selected: false, onEdge: true })).toBe("drag");
    const nodes = [{ id: "text", kind: "text", x: 0, y: 0, width: 1200, height: 900 }, { id: "card", kind: "work", x: 300, y: 0, width: 260, height: 180 }] as LabNode[];
    expect(placementRectsForNodes(nodes)).toEqual([{ x: 300, y: 0, width: 260, height: 180 }]);
  });
});