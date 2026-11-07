import { describe, expect, it } from "vitest";

import { parseManifest, shareBucket } from "@/lib/context-manifest";
import { accountTextResults, headAndTail, recordIndexBlock, storedCharsHint, RAW_BUDGET } from "@/lib/reflect-context.server";
import { parseScope } from "@/lib/reflect-shared";

describe("TOTAL-1 read-set contract", () => {
  it("budget is the window, not a tier", () => {
    expect(RAW_BUDGET).toBe(3_200_000);
  });

  it("a 221k-character item is read whole", () => {
    const text = "a".repeat(221_572);
    const state = { fullText: new Map<string, string>(), unreadable: new Map(), rawUsed: 0, charsTotal: new Map<string, number>() };
    const out = accountTextResults(
      [{ item: { id: "wb", content_ref: "x" }, result: { status: "ok", text } }],
      RAW_BUDGET,
      state,
    );
    expect(out.anyCut).toBe(false);
    expect(state.fullText.get("wb")?.length).toBe(221_572);
    expect(state.charsTotal.get("wb")).toBe(221_572);
  });

  it("a cut is sized to the room it has, head and tail", () => {
    const text = `${"h".repeat(5000)}${"m".repeat(5000)}${"t".repeat(5000)}`;
    const out = headAndTail(text, 1000);
    expect(out.cut).toBe(true);
    expect(out.text.length).toBeLessThanOrEqual(1000);
    expect(out.text.startsWith("h")).toBe(true);
    expect(out.text.endsWith("t")).toBe(true);
  });

  it("the record index names every item, counts turns, and marks the unselected not read", () => {
    const block = recordIndexBlock(
      [
        { id: "a", title: "Diligence chat", type: "ai_thread", date: "2026-10-22", selected: true, turns: 50, chars: 35917, charsExact: true },
        { id: "b", title: "Working Backwards", type: "document", date: "2026-10-27", selected: false, turns: null, chars: 221572, charsExact: false },
        { id: "c", title: "Branch", type: "ai_thread", date: "2026-11-03", selected: true, turns: null, chars: null, charsExact: false },
      ],
      "D8 - Liam Plan",
    );
    expect(block).toContain("3 items, 2 conversations");
    expect(block).toContain("2 of 3 are in the read set");
    expect(block).toContain("1. Diligence chat (conversation, 2026-10-22, 50 turns)");
    expect(block).toContain("2. Working Backwards (document, 2026-10-27, about 221,572 characters) NOT READ");
    expect(block).toContain("3. Branch (conversation, 2026-11-03, turns not stored)");
    expect(block).not.toContain("50 turns in total");
  });

  it("the index states the total turns only when every conversation's count is known", () => {
    const block = recordIndexBlock(
      [
        { id: "a", title: "One", type: "ai_thread", date: "2026-10-22", selected: true, turns: 50, chars: null, charsExact: false },
        { id: "b", title: "Two", type: "ai_thread", date: "2026-10-29", selected: true, turns: 12, chars: null, charsExact: false },
      ],
      null,
    );
    expect(block).toContain("with 62 turns in total");
  });

  it("the manifest carries the read-set proof line through persistence", () => {
    const parsed = parseManifest({
      items: [{ id: "a", title: "Chat", kind: "conversation", detail: "turns 1–50", chars_in: 35917, chars_total: 35917 }],
      excluded: [],
      brief_included: false,
      firm_checks_applied: 0,
      assembled_at: "2026-11-07T00:00:00Z",
      read_set: { ids: ["a"], items_with_text: 1, chars_total: 35917, chars_in: 35917, share: 1 },
    });
    expect(parsed?.read_set?.share).toBe(1);
    expect(parsed?.items[0]?.chars_in).toBe(35917);
  });

  it("share buckets are the only form the share leaves as a dimension", () => {
    expect(shareBucket(1)).toBe("100");
    expect(shareBucket(0.95)).toBe("90-99");
    expect(shareBucket(0.3)).toBe("under-90");
    expect(shareBucket(undefined)).toBe("none");
  });

  it("a scope keeps its board, and the cached size hint only counts an ok read", () => {
    expect(parseScope({ mode: "items", ids: ["x"], board: "b1" })).toEqual({ mode: "items", ids: ["x"], board: "b1" });
    expect(parseScope({ mode: "whole", ids: [], board: "b1" })).toEqual({ mode: "whole", ids: [] });
    expect(storedCharsHint({ meta: { text_chars: 120, text_status: "ok" } })).toBe(120);
    expect(storedCharsHint({ meta: { text_chars: 120, text_status: "unreadable" } })).toBe(0);
    expect(storedCharsHint({ meta: null })).toBe(0);
  });
});

describe("TOTAL-1 size switch", () => {
  it("the catalogue trigger is the window, with an item ceiling the loader can see", async () => {
    const mod = await import("@/lib/record-catalogue.server");
    expect(mod.CATALOGUE_CHARS).toBe(3_200_000);
    expect(mod.CATALOGUE_THRESHOLD).toBe(300);
  });
});
