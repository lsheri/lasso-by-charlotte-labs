// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parseAnswerBody, serializeAnswerBody } from "@/lib/answer-card";
import { parseWorkboardTextBody, parseWorkboardStickyBody, serializeWorkboardTextBody, serializeWorkboardStickyBody, type WorkboardDto } from "@/lib/canvas-lab-shared";
import { validNodeInput, validNodeUpdate } from "@/lib/canvas-lab.server";
import { applyDurableBoard } from "@/components/canvas-lab/canvas-lab-model";
import { sharedNodeBody } from "@/lib/board-share-open.server";

vi.mock("@/lib/telemetry.server", () => ({ sha256Hex: async () => "h", recordEvent: vi.fn() }));
vi.mock("../telemetry.server", () => ({ sha256Hex: async () => "h", recordEvent: vi.fn() }));

const style = { size: "body", weight: "regular", colour: "ink" } as const;
const edited = (html = "<p>Current <strong>answer</strong></p>", original = "Original answer") => serializeAnswerBody({ text: "Current answer", html, original, editedAt: "2026-10-12T22:31:00Z" });

describe("BE-4 string body storage", () => {
  it("reads legacy bodies unchanged, including JSON-looking answer prose", () => {
    expect(parseAnswerBody("Original answer")).toEqual({ text: "Original answer", html: null, original: null, editedAt: null });
    expect(parseAnswerBody('{"text":"legacy"}').text).toBe('{"text":"legacy"}');
    const text = { text: "Words", ...style };
    expect(parseWorkboardTextBody(serializeWorkboardTextBody(text))).toEqual(text);
    expect(parseWorkboardStickyBody(serializeWorkboardStickyBody({ ...text, fill: "yellow" }))).toEqual({ ...text, fill: "yellow" });
  });

  it("round trips optional html, computes the plain copy, and accepts 600 characters", () => {
    const sticky = { text: "ignored", html: "<ul><li>Words</li></ul>", ...style, fill: "yellow" as const };
    expect(parseWorkboardStickyBody(serializeWorkboardStickyBody(sticky))).toEqual({ ...sticky, text: "- Words" });
    const body = serializeWorkboardTextBody({ text: "x".repeat(600), ...style });
    expect(validNodeInput({ clientKey: "t", frameKey: null, kind: "text", body, x: 0, y: 0, w: 260, h: 80 })).toBeNull();
    expect(parseWorkboardTextBody(JSON.stringify({ text: "Words", ...style, extra: true }))).toBeNull();
  });

  it("allows edits only when the original stays byte-identical", () => {
    const first = edited();
    expect(validNodeUpdate("answer", { body: first }, "Original answer")).toBeNull();
    expect(validNodeUpdate("answer", { body: edited(undefined, "Changed original") }, "Original answer")).toBe("The original answer is kept as it was.");
    expect(validNodeUpdate("answer", { body: edited("<p>Second edit</p>") }, first)).toBeNull();
    expect(validNodeUpdate("answer", { body: "Replaced prose" }, first)).toBe("The original answer is kept as it was.");
    expect(validNodeUpdate("answer", { body: first }, first)).toBeNull();
  });

  it("rejects oversized html and text on the server without trusting serializers", () => {
    const html = "x".repeat(20001);
    expect(parseWorkboardTextBody(JSON.stringify({ text: "x", html, ...style }))).toBeNull();
    expect(parseWorkboardStickyBody(JSON.stringify({ text: "x", html, ...style, fill: "yellow" }))).toBeNull();
    const body = JSON.stringify({ text: "x", html, original: "Original answer", edited_at: "2026-10-12T22:31:00Z" });
    expect(validNodeUpdate("answer", { body }, "Original answer")).toBe("Invalid answer body.");
    expect(validNodeUpdate("answer", { body: JSON.stringify({ text: "x".repeat(5001), html: "<p>x</p>", original: "Original answer", edited_at: "now" }) }, "Original answer")).toBe("Invalid answer body.");
    expect(() => edited(html)).toThrow();
  });

  it("maps current answer words and strips rich markup/history from public egress", () => {
    const body = edited();
    const board: WorkboardDto = { id: "b", engagementId: "e", version: 1, frames: [], links: [], viewerProfileId: "me", canEditStructure: true, archivedContextFrame: null,
      nodes: [{ id: "a", kind: "answer", frameId: null, workItemId: null, decisionId: null, authorProfileId: "me", authorName: "Liam", title: "Answer", body, judgmentType: null, x: 0, y: 0, w: 320, h: 240, hidden: false, version: 1, referenceReadable: true }] };
    const mapped = applyDurableBoard({ frames: [], nodes: [] }, board);
    expect(mapped.nodes[0]?.summary).toBe("Current answer");
    expect(mapped.nodes[0]?.summary).not.toContain("<");
    expect(sharedNodeBody("answer", body)).toBe("Current answer");
    expect(sharedNodeBody("sticky", serializeWorkboardStickyBody({ text: "Words", html: "<p>Words</p>", ...style, fill: "yellow" }))).not.toContain("html");
    expect(sharedNodeBody("text", serializeWorkboardTextBody({ text: "Words", html: "<p>Words</p>", ...style }))).not.toContain("<");
    // Ask receives selected work-item IDs, not authored answer bodies. Do not introduce new context content.
    const ask = readFileSync("src/components/canvas-lab/BoardAsk.tsx", "utf8");
    expect(ask).toContain("ask.setBoardSelection(props.boardContextHasPicks, inMapped)");
    expect(ask).not.toContain(".body");
    expect(ask).not.toContain(".summary");
    const context = readFileSync("src/lib/reflect-context.server.ts", "utf8");
    expect(context).not.toContain("workboard_nodes");
  });

  it("keeps mention records off the public board body", () => {
    const profileId = "11111111-1111-4111-8111-111111111111";
    const body = serializeWorkboardStickyBody({ text: "Words from @Ben Stanton", html: "<p>Words from @Ben Stanton</p>", ...style, fill: "yellow" as const, mentions: [{ profileId, label: "Ben Stanton", start: 11, length: 12 }] });
    // The fixture must really carry the record, or the assertions below pass vacuously.
    expect(body).toContain(profileId);
    const shared = sharedNodeBody("sticky", body);
    expect(shared).toContain("Words from @Ben Stanton");
    expect(shared).not.toContain("html");
    expect(shared).not.toContain("mentions");
    expect(shared).not.toContain(profileId);
  });
});