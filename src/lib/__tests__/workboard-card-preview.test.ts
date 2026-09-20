import { describe, expect, it, vi } from "vitest";

import { readWorkboardCardPreviews } from "@/lib/workboard-card-preview.server";
import { readWorkboardDisplayMode, workboardDisplayModeKey } from "@/lib/workboard-card-preview.shared";

describe("workboard card previews", () => {
  it("defaults to Sticky and scopes the choice to viewer and engagement", () => {
    expect(readWorkboardDisplayMode(null)).toBe("sticky");
    expect(readWorkboardDisplayMode("preview")).toBe("preview");
    expect(workboardDisplayModeKey("person", "engagement")).toContain("person:engagement");
  });

  it("uses one caller-scoped read and returns only the last three turns", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      work_item_id: "visible-chat",
      turn_no: index + 1,
      role: index % 2 ? "assistant" : "user",
      content: `turn ${index + 1}`,
      model: "model-name",
    }));
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const inFn = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const db = { from: vi.fn().mockReturnValue({ select }) };

    const result = await readWorkboardCardPreviews(db as never, ["visible-chat"]);
    expect(db.from).toHaveBeenCalledTimes(1);
    expect(inFn).toHaveBeenCalledWith("work_item_id", ["visible-chat"]);
    expect(result[0]?.turns.map((turn) => turn.turnNo)).toEqual([3, 4, 5]);
    expect(result[0]?.turnCount).toBe(5);
  });
});