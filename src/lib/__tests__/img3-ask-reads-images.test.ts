import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

import { imageTitle, IMAGE_DESCRIPTION_LABEL, loadBoardImages, MAX_IMAGE_DESCRIBE_INLINE } from "../reflect-context.server";
import { MAX_SCOPE_IMAGES, parseScope } from "../reflect-shared";

type Row = { id: string; image_text: string | null; image_text_status: string | null; workboard_id?: string };

function fakeSupabase(rows: Row[], boards: { id: string; engagement_id: string }[] = []) {
  const calls: { table: string; filters: Record<string, unknown> }[] = [];
  return {
    calls,
    rows,
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const chain = {
        select: () => chain,
        in: (column: string, values: unknown[]) => { filters[`in:${column}`] = values; return chain; },
        eq: (column: string, value: unknown) => { filters[`eq:${column}`] = value; return chain; },
        is: (column: string, value: unknown) => { filters[`is:${column}`] = value; return chain; },
        then: (resolve: (value: { data: unknown }) => void) => {
          calls.push({ table, filters: { ...filters } });
          if (table === "workboards") {
            const ids = filters["in:engagement_id"] as string[];
            return resolve({ data: boards.filter((b) => ids.includes(b.engagement_id)).map((b) => ({ id: b.id })) });
          }
          const byId = filters["in:id"] as string[] | undefined;
          const byBoard = filters["in:workboard_id"] as string[] | undefined;
          return resolve({ data: rows.filter((r) => (byId ? byId.includes(r.id) : byBoard ? byBoard.includes(r.workboard_id ?? "") : false)) });
        },
      };
      return chain;
    },
  };
}

describe("IMG-3 scope carries picked images", () => {
  it("keeps image ids, dedupes, caps, and leaves scopes without them unchanged", () => {
    expect(parseScope({ mode: "items", ids: ["w1"], images: ["i1", "i1", "i2", 3] })).toEqual({ mode: "items", ids: ["w1"], images: ["i1", "i2"] });
    expect(parseScope({ mode: "items", ids: ["w1"] })).toEqual({ mode: "items", ids: ["w1"] });
    expect(parseScope({ mode: "items", ids: [], images: Array.from({ length: 80 }, (_, i) => `i${i}`) }).images).toHaveLength(MAX_SCOPE_IMAGES);
    expect(parseScope({ mode: "whole", ids: [], images: ["i1"] })).toEqual({ mode: "whole", ids: [] });
  });
});

describe("IMG-3 loadBoardImages", () => {
  it("reads picked images through the caller's client, image cards only, sorted", async () => {
    const db = fakeSupabase([
      { id: "i2", image_text: "Slide B", image_text_status: "ok" },
      { id: "i1", image_text: "Slide A", image_text_status: "ok" },
    ]);
    const out = await loadBoardImages(db as never, { mode: "items", ids: ["w1"], images: ["i1", "i2"] });
    expect(out.map((i) => i.id)).toEqual(["i1", "i2"]);
    expect(db.calls[0]!.filters).toMatchObject({ "eq:kind": "image", "is:deleted_at": null });
  });
  it("a whole-board ask includes every image on that board", async () => {
    const db = fakeSupabase([{ id: "i9", image_text: "Flow", image_text_status: "ok", workboard_id: "b1" }], [{ id: "b1", engagement_id: "e1" }]);
    const out = await loadBoardImages(db as never, { mode: "engagements", ids: ["e1"] });
    expect(out).toEqual([{ id: "i9", text: "Flow", status: "ok" }]);
  });
  it("an items ask with no picked images reads no images", async () => {
    const db = fakeSupabase([{ id: "i9", image_text: "Flow", image_text_status: "ok", workboard_id: "b1" }]);
    expect(await loadBoardImages(db as never, { mode: "items", ids: ["w1"] })).toEqual([]);
  });
  it("describes never-read images inline, at most the cap, then re-reads", async () => {
    const rows: Row[] = Array.from({ length: 6 }, (_, i) => ({ id: `i${i}`, image_text: null, image_text_status: null }));
    const db = fakeSupabase(rows);
    const describe = vi.fn(async (id: string) => {
      const row = rows.find((r) => r.id === id)!;
      row.image_text = `Described ${id}`;
      row.image_text_status = "ok";
    });
    const out = await loadBoardImages(db as never, { mode: "items", ids: [], images: rows.map((r) => r.id) }, describe);
    expect(describe).toHaveBeenCalledTimes(MAX_IMAGE_DESCRIBE_INLINE);
    expect(out.filter((i) => i.text)).toHaveLength(MAX_IMAGE_DESCRIBE_INLINE);
  });
  it("skipped or failed images carry no text, so they are never read as content", async () => {
    const db = fakeSupabase([
      { id: "i1", image_text: null, image_text_status: "skipped" },
      { id: "i2", image_text: "stale", image_text_status: "failed" },
    ]);
    const out = await loadBoardImages(db as never, { mode: "items", ids: [], images: ["i1", "i2"] });
    expect(out.every((i) => i.text === null)).toBe(true);
  });
  it("never throws", async () => {
    const broken = { from: () => { throw new Error("boom"); } };
    expect(await loadBoardImages(broken as never, { mode: "items", ids: [], images: ["i1"] })).toEqual([]);
  });
});

describe("IMG-3 labels", () => {
  it("titles an image from the first line of its description", () => {
    expect(imageTitle("1. A slide titled Q3 plan\n2. Revenue")).toBe("Image: A slide titled Q3 plan");
    expect(imageTitle(null)).toBe("Image on the board");
  });
  it("the label says it is an AI description, not the image", () => {
    expect(IMAGE_DESCRIPTION_LABEL).toBe("AI description of an image on the board. Not the image itself.");
    expect(IMAGE_DESCRIPTION_LABEL).not.toMatch(/—/);
  });
});
