import { describe, expect, it } from "vitest";

import { anchorStitches, joinRuns, readPageRuns } from "@/components/provenance/SlidesPane";
import { enclosedRuns, snippetFromRuns, type TextRun } from "@/lib/lasso-geometry";
import { findSnippetOffset } from "@/lib/span-provenance-shared";

/** Runs handed over in pdf.js item order, which is not reading order. */
const scrambled: TextRun[] = [
  { text: "second line here", x: 0, y: 40, w: 160, h: 10 },
  { text: "opening words", x: 0, y: 0, w: 140, h: 10 },
  { text: "and the rest", x: 150, y: 0, w: 120, h: 10 },
];

const around = [
  { x: -10, y: -10 },
  { x: 400, y: -10 },
  { x: 400, y: 20 },
  { x: -10, y: 20 },
];

describe("pass 101.3: one reading order for the lasso and the page text", () => {
  it("finds a lassoed snippet in the joined page text", () => {
    const snippet = snippetFromRuns(enclosedRuns(scrambled, around));
    expect(snippet).toBe("opening words and the rest");
    const page = joinRuns(scrambled);
    expect(page.runs.map((run) => run.text)).toEqual([
      "opening words",
      "and the rest",
      "second line here",
    ]);
    expect(findSnippetOffset(page.text, snippet, 1)).not.toBeNull();
  });

  it("keeps offsets aligned with the sorted runs", () => {
    const page = joinRuns(scrambled);
    page.runs.forEach((run, i) => {
      const at = page.offsets[i] as number;
      expect(page.text.slice(at, at + run.text.length)).toBe(run.text);
    });
  });
});

describe("pass 101.3: text without paint", () => {
  const fakePdfjs = {
    Util: { transform: (_a: number[], b: number[]) => b },
  };
  const fakePage = {
    getViewport: () => ({ transform: [1, 0, 0, 1, 0, 0] }),
    getTextContent: async () => ({
      items: [
        { str: "Margin held at nineteen percent", transform: [1, 0, 0, 1, 0, 60], width: 200, height: 10 },
      ],
    }),
  };

  it("anchors a stitch on a page that was read but never painted", async () => {
    const runs = await readPageRuns(fakePdfjs, fakePage, 1);
    expect(runs).toHaveLength(1);
    const pages = new Map([[4, joinRuns(runs)]]);
    const { anchors, orphans } = anchorStitches(pages, [
      {
        id: "s1",
        status: "exact",
        locator: { unit: "slide", index: 4, snippet: "Margin held at nineteen percent" },
      } as never,
    ]);
    expect(orphans).toHaveLength(0);
    expect(anchors[0]?.page).toBe(4);
  });
});
