import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { readWorkboardCardPreviews } from "@/lib/workboard-card-preview.server";
import { previewWheelConsumesScroll, readWorkboardDisplayMode, workboardDisplayModeKey } from "@/lib/workboard-card-preview.shared";
import { slidesFromMap } from "@/lib/workboard-file-preview";

describe("workboard card previews", () => {
  it("keeps every mapped slide available to the shared renderer", () => {
    expect(slidesFromMap({ slides: [{ title: "One", body: "First" }, { title: "Two", body: "Second" }] })).toEqual([
      { title: "One", lines: ["First"] },
      { title: "Two", lines: ["Second"] },
    ]);
  });
  it("defaults to Preview and scopes the choice to viewer and engagement", () => {
    expect(readWorkboardDisplayMode(null)).toBe("preview");
    expect(readWorkboardDisplayMode("pile")).toBe("preview");
    expect(workboardDisplayModeKey("person", "engagement")).toContain("person:engagement");
  });

  it("reads stored summaries with the turns, preserves the first user turn, and returns the last three turns", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      work_item_id: "visible-chat",
      turn_no: index + 1,
      role: index % 2 ? "assistant" : "user",
      content: index === 4 ? "x".repeat(450) : `turn ${index + 1}`,
      model: "model-name",
    }));
    const turnIn = vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: rows, error: null }) });
    const summaryIn = vi.fn().mockResolvedValue({ data: [{ work_item_id: "visible-chat", summary: "Stored extract" }], error: null });
    const db = { from: vi.fn((table: string) => ({ select: vi.fn().mockReturnValue({ in: table === "turns" ? turnIn : summaryIn }) })) };

    const result = await readWorkboardCardPreviews(db as never, ["visible-chat"]);
    expect(db.from).toHaveBeenCalledTimes(2);
    expect(turnIn).toHaveBeenCalledWith("work_item_id", ["visible-chat"]);
    expect(summaryIn).toHaveBeenCalledWith("work_item_id", ["visible-chat"]);
    expect(result[0]?.summary).toBe("Stored extract");
    expect(result[0]?.turns.map((turn) => turn.turnNo)).toEqual([3, 4, 5]);
    expect(result[0]?.firstUserTurn).toEqual({ turnNo: 1, role: "user", content: "turn 1" });
    expect(result[0]?.turnCount).toBe(5);
    expect(result[0]?.turns[2]?.content).toHaveLength(400);
  });

  it("keeps the read capped at 100 unique ids", async () => {
    const turnIn = vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) });
    const summaryIn = vi.fn().mockResolvedValue({ data: [], error: null });
    const db = { from: vi.fn((table: string) => ({ select: vi.fn().mockReturnValue({ in: table === "turns" ? turnIn : summaryIn }) })) };
    const ids = Array.from({ length: 110 }, (_, index) => `chat-${index}`);
    await readWorkboardCardPreviews(db as never, ids);
    expect(turnIn.mock.calls[0]?.[1]).toHaveLength(100);
    expect(summaryIn.mock.calls[0]?.[1]).toHaveLength(100);
  });

  it("keeps shared vendor colors intact and isolates Preview card colors", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain("--vendor-chatgpt: #0f6b5c;");
    expect(css).toContain("--vendor-chatgpt: #6fc4b2;");
    expect(css).toContain("--canvas-vendor-chatgpt: var(--nb-graphite);");
    expect(css).toContain("var(--canvas-preview-vendor, var(--canvas-vendor-other))");
  });

  it("chains the wheel at either edge and never captures it before focus", () => {
    expect(previewWheelConsumesScroll(false, 20, 20, 100, 300)).toBe(false);
    expect(previewWheelConsumesScroll(true, -20, 0, 100, 300)).toBe(false);
    expect(previewWheelConsumesScroll(true, 20, 200, 100, 300)).toBe(false);
    expect(previewWheelConsumesScroll(true, 20, 40, 100, 300)).toBe(true);
  });
});