import { describe, expect, it } from "vitest";

import {
  anchorStitches,
  highlightRects,
  joinRuns,
  type PageText,
} from "@/components/provenance/SlidesPane";
import { denormalizeBBox } from "@/lib/lasso-geometry";
import type { AuditStitch } from "@/lib/span-provenance.functions";

function page(text: string[]): PageText {
  return joinRuns(text.map((t, i) => ({ text: t, x: 10, y: 20 * i, w: 100, h: 12 })));
}

function stitch(id: string, locator: Omit<AuditStitch["locator"], "occurrence"> & { occurrence?: number }): AuditStitch {
  return {
    id,
    status: "exact",
    question: "Where did this come from?",
    answer: "",
    locator: { occurrence: 1, ...locator },
    sources: [],
  } as unknown as AuditStitch;
}

describe("pass 101.4 bbox anchoring", () => {
  const pages = new Map<number, PageText>([
    [1, page(["$78,400", "something else"])],
    [2, page(["Median annual wage"])],
  ]);

  it("anchors a bbox stitch on its named page even when the snippet is not findable", () => {
    const s = stitch("a", {
      unit: "slide",
      index: 2,
      snippet: "$78,400 Median annual wage",
      bbox: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
    });
    const { anchors, orphans } = anchorStitches(pages, [s]);
    expect(orphans).toHaveLength(0);
    expect(anchors[0]?.page).toBe(2);
    expect(anchors[0]?.bbox).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  });

  it("still snippet-anchors a stitch without a bbox", () => {
    const s = stitch("b", { unit: "slide", index: 1, snippet: "$78,400" });
    const { anchors, orphans } = anchorStitches(pages, [s]);
    expect(orphans).toHaveLength(0);
    expect(anchors[0]?.page).toBe(1);
    expect(anchors[0]?.bbox).toBeUndefined();
    expect(anchors[0]?.end).toBeGreaterThan(anchors[0]?.start ?? 0);
  });

  it("denormalizes a bbox to page pixels", () => {
    expect(denormalizeBBox({ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, 800, 600)).toEqual({
      x: 400,
      y: 300,
      w: 80,
      h: 60,
    });
    const rects = highlightRects(
      [
        {
          stitch: stitch("c", { unit: "slide", index: 1, snippet: "x" }),
          page: 1,
          start: 0,
          end: 0,
          bbox: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
        },
      ],
      page([]),
      800,
      600,
    );
    expect(rects[0]?.run).toEqual({ x: 400, y: 300, w: 80, h: 60 });
  });

  it("keeps only unanchorable stitches in the rail", () => {
    const bad = stitch("d", { unit: "slide", index: 9, snippet: "nowhere on this deck" });
    const good = stitch("e", { unit: "slide", index: 9, snippet: "x", bbox: { x: 0, y: 0, w: 1, h: 1 } });
    const okPage = stitch("f", { unit: "slide", index: 1, snippet: "$78,400" });
    const { anchors, orphans } = anchorStitches(pages, [bad, good, okPage]);
    // page 9 does not exist, so the bbox stitch falls back to snippet search too
    expect(orphans.map((o) => o.id)).toEqual(["d", "e"]);
    expect(anchors.map((a) => a.stitch.id)).toEqual(["f"]);
  });
});
