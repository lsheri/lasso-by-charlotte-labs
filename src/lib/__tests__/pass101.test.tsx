// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TRY_AGAIN_TITLE, LassoLayer } from "@/components/provenance/LassoLayer";
import { joinRuns, runsForSnippet } from "@/components/provenance/SlidesPane";
import {
  enclosedRuns,
  pageLabel,
  pageUnitFor,
  pointInPolygon,
  snippetFromRuns,
  unionBBox,
  type TextRun,
} from "@/lib/lasso-geometry";
import { resolveRendition } from "@/lib/rendition.server";
import { snippetHash, spanIdempotencyKey } from "@/lib/span-provenance-shared";

afterEach(() => cleanup());

const runs: TextRun[] = [
  { text: "The margin held at nineteen percent", x: 10, y: 10, w: 200, h: 20 },
  { text: "Headcount grew by four", x: 10, y: 200, w: 200, h: 20 },
];

/** A rectangle drawn around the first run only. */
const aroundFirst = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 60 },
  { x: 0, y: 60 },
];

describe("pass 101: the lasso hit test", () => {
  it("takes only the run the ink went around", () => {
    expect(pointInPolygon({ x: 110, y: 20 }, aroundFirst)).toBe(true);
    const inside = enclosedRuns(runs, aroundFirst);
    expect(inside).toHaveLength(1);
    expect(snippetFromRuns(inside)).toBe("The margin held at nineteen percent");
    expect(unionBBox(inside)).toEqual({ x: 10, y: 10, w: 200, h: 20 });
  });

  it("returns nothing when the ink encloses no text", () => {
    expect(
      enclosedRuns(runs, [
        { x: 400, y: 400 },
        { x: 500, y: 400 },
        { x: 500, y: 500 },
        { x: 400, y: 500 },
      ]),
    ).toHaveLength(0);
  });
});

/** A drawn loop: the corners with points along each edge, the way a hand moves. */
function drawLasso(polygon: { x: number; y: number }[]) {
  const layer = screen.getByTestId("lasso-layer");
  const first = polygon[0] as { x: number; y: number };
  fireEvent.pointerDown(layer, { clientX: first.x, clientY: first.y });
  polygon.forEach((point, i) => {
    const from = polygon[i] as { x: number; y: number };
    const to = polygon[(i + 1) % polygon.length] as { x: number; y: number };
    for (let step = 1; step <= 4; step += 1) {
      fireEvent.pointerMove(layer, {
        clientX: from.x + ((to.x - from.x) * step) / 4,
        clientY: from.y + ((to.y - from.y) * step) / 4,
      });
    }
  });
  fireEvent.pointerUp(layer);
}

describe("pass 101: an empty lasso costs nothing", () => {
  it("fires no ask and says so plainly", () => {
    const onLasso = vi.fn();
    const onEmpty = vi.fn();
    render(
      <LassoLayer
        armed
        runs={runs}
        width={300}
        height={300}
        reduceMotion={false}
        settled={null}
        resolving={false}
        onLasso={onLasso}
        onEmpty={onEmpty}
      />,
    );
    drawLasso([
      { x: 260, y: 260 },
      { x: 290, y: 260 },
      { x: 290, y: 290 },
      { x: 260, y: 290 },
    ]);
    expect(onLasso).not.toHaveBeenCalled();
    expect(onEmpty).toHaveBeenCalled();
    expect(screen.getByText(TRY_AGAIN_TITLE)).toBeTruthy();
  });

  it("hands back the enclosed snippet when the ink found text", () => {
    const onLasso = vi.fn();
    render(
      <LassoLayer
        armed
        runs={runs}
        width={300}
        height={300}
        reduceMotion={false}
        settled={null}
        resolving={false}
        onLasso={onLasso}
        onEmpty={() => {}}
      />,
    );
    drawLasso(aroundFirst);
    expect(onLasso).toHaveBeenCalledTimes(1);
    expect(onLasso.mock.calls[0]?.[0].snippet).toBe("The margin held at nineteen percent");
  });
});

describe("pass 101: reduced motion is static", () => {
  function ink(reduceMotion: boolean) {
    cleanup();
    render(
      <LassoLayer
        armed
        runs={runs}
        width={300}
        height={300}
        reduceMotion={reduceMotion}
        settled={[
          { x: 10, y: 10 },
          { x: 90, y: 12 },
          { x: 88, y: 60 },
          { x: 12, y: 58 },
        ]}
        resolving
        onLasso={() => {}}
        onEmpty={() => {}}
      />,
    );
    return screen.getByTestId("lasso-ink").getAttribute("class") ?? "";
  }

  it("drops the settle animation and the dash march", () => {
    expect(ink(false)).toContain("nb-ink-settle");
    expect(ink(false)).toContain("nb-ink-march");
    const still = ink(true);
    expect(still).toContain("nb-ink-static");
    expect(still).toContain("nb-ink-march-static");
    expect(still).not.toContain("nb-ink-settle");
  });

  it("draws the thread without animating it", async () => {
    const { ThreadLine } = await import("@/components/provenance/ThreadLine");
    cleanup();
    render(<ThreadLine from={{ x: 300, y: 100 }} targetId={null} sourced={false} reduceMotion />);
    const line = screen.getByTestId("audit-thread").querySelector("line");
    expect(line?.getAttribute("class")).toBeFalsy();
    expect(line?.getAttribute("class") ?? "").not.toContain("nb-thread-draw");
  });
});

describe("pass 101: page labels are never guessed", () => {
  it("calls a page a slide only on presentation evidence", () => {
    expect(pageUnitFor({ webViewLink: "https://docs.google.com/presentation/d/1/edit" })).toBe(
      "slide",
    );
    expect(pageUnitFor({ text: "## Slide 1\nOpening" })).toBe("slide");
    expect(pageUnitFor({ webViewLink: "https://docs.google.com/document/d/1/edit" })).toBe("page");
    expect(pageUnitFor({})).toBe("page");
    expect(pageLabel("slide", 3)).toBe("Slide 3");
    expect(pageLabel("page", 3)).toBe("Page 3");
  });
});

describe("pass 101: the page unit reaches the server contract", () => {
  it("accepts unit page and rejects an unknown unit", async () => {
    const { validLocatorForTest } = await import("@/lib/span-provenance.functions");
    const locator = validLocatorForTest({
      unit: "page",
      index: 4,
      snippet: "The margin held at nineteen percent",
      occurrence: 1,
      bbox: { x: 0.1, y: 0.2, w: 0.3, h: 0.05 },
    });
    expect(locator.unit).toBe("page");
    expect(locator.bbox).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.05 });
    expect(() => validLocatorForTest({ unit: "canvas", snippet: "a long enough snippet" })).toThrow(
      /could not be placed/,
    );
  });

  it("carries the page unit and index in the reuse key", async () => {
    const hash = await snippetHash("the margin held");
    expect(
      spanIdempotencyKey({
        anchorId: "deck-1",
        unit: "page",
        index: 4,
        snippetHash: hash,
        upstreamIds: ["b", "a"],
      }),
    ).toBe(`span_provenance:deck-1:page:4:${hash}:with:a,b`);
  });
});

describe("pass 101: rendition access", () => {
  function clientFor(row: Record<string, unknown> | null) {
    const api: Record<string, unknown> = {};
    api["select"] = () => api;
    api["eq"] = () => api;
    api["maybeSingle"] = async () => ({ data: row });
    return { from: () => api } as never;
  }
  const sign = async () => "https://signed.example/deck.pdf";

  it("signs a readable pdf", async () => {
    const result = await resolveRendition(
      clientFor({ id: "d1", content_ref: "org/deck.pdf", meta: { mime_type: "application/pdf" } }),
      "d1",
      sign,
    );
    expect(result).toEqual({ kind: "pdf", url: "https://signed.example/deck.pdf" });
  });

  it("answers none for an item whose bytes are not a pdf", async () => {
    const result = await resolveRendition(
      clientFor({
        id: "d1",
        content_ref: "org/deck.pptx",
        meta: {
          mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        },
      }),
      "d1",
      sign,
    );
    expect(result).toEqual({ kind: "none" });
  });

  it("answers none when row level security returns nothing", async () => {
    const signer = vi.fn(sign);
    expect(await resolveRendition(clientFor(null), "d1", signer)).toEqual({ kind: "none" });
    expect(signer).not.toHaveBeenCalled();
  });
});

describe("pass 101: stitches survive the view toggle", () => {
  it("re-anchors a text view snippet against the page's own runs", () => {
    const page = joinRuns([
      { text: "Margin held", x: 0, y: 0, w: 100, h: 10 },
      { text: "at nineteen percent", x: 100, y: 0, w: 100, h: 10 },
      { text: "Margin held again", x: 0, y: 40, w: 100, h: 10 },
    ]);
    const matched = runsForSnippet(page, "Margin held at nineteen percent", 1);
    expect(matched.map((run) => run.text)).toEqual(["Margin held", "at nineteen percent"]);
    expect(runsForSnippet(page, "Margin held", 2).map((r) => r.text)).toEqual([
      "Margin held again",
    ]);
    expect(runsForSnippet(page, "nothing like this", 1)).toEqual([]);
  });
});

describe("pass 101.1: the status colour language", () => {
  it("gives each status its own stable classes", async () => {
    const { spanStatusClass, spanStatusStroke, spanStatusWash } =
      await import("@/lib/span-status-style");
    expect(spanStatusClass("exact")).toBe("nb-span nb-span-exact");
    expect(spanStatusClass("paraphrase")).toBe("nb-span nb-span-paraphrase");
    expect(spanStatusClass("unsourced")).toBe("nb-span nb-span-unsourced");
    expect(
      new Set([
        spanStatusStroke("exact"),
        spanStatusStroke("paraphrase"),
        spanStatusStroke("unsourced"),
      ]).size,
    ).toBe(3);
    expect(spanStatusWash("exact")).toBe("var(--status-exact-wash)");
  });

  it("colours the chip and pins it in, or stays still under reduced motion", async () => {
    const { StitchChip } = await import("@/components/provenance/StitchChip");
    const stitch = {
      id: "s1",
      locator: { unit: "page", index: 1, snippet: "margin held", occurrence: 1 },
      question: "Where did this come from?",
      quote: "margin held",
      status: "paraphrase",
      verification: "none_in_record",
      verification_note: null,
      to_item_id: "u1",
      to_item_title: "Kickoff",
      to_item_url: null,
      to_turn_id: null,
      to_turn_no: null,
      asked_by: "p1",
      asked_by_name: null,
      created_at: "2026-01-01",
    } as never;
    cleanup();
    render(<StitchChip stitch={stitch} onGoToSource={() => {}} />);
    const moving = screen.getByTestId("stitch-chip-s1").getAttribute("class") ?? "";
    expect(moving).toContain("nb-span-paraphrase");
    expect(moving).toContain("nb-stitch-chip");
    expect(moving).toContain("nb-chip-enter");
    cleanup();
    render(<StitchChip stitch={stitch} onGoToSource={() => {}} reduceMotion />);
    const still = screen.getByTestId("stitch-chip-s1").getAttribute("class") ?? "";
    expect(still).toContain("nb-chip-enter-static");
    expect(still).not.toContain("nb-chip-enter ");
  });

  it("defines one token per status rather than raw colour at point of use", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/styles.css", "utf8");
    ["--status-exact", "--status-paraphrase", "--status-unsourced"].forEach((token) => {
      expect(css).toContain(`${token}:`);
      expect(css).toContain(`${token}-wash:`);
    });
    expect(css).toContain(".nb-span-unsourced.nb-stitch-chip");
  });
});

describe("pass 101.1: the loader reads the link where production keeps it", () => {
  it("prefers meta.web_view_link over source_meta", async () => {
    const { webViewLinkOf } = await import("@/lib/span-audit.server");
    const link = "https://docs.google.com/presentation/d/1/edit";
    expect(webViewLinkOf({ meta: { web_view_link: link }, source_meta: {} })).toBe(link);
    expect(webViewLinkOf({ meta: {}, source_meta: { web_view_link: link } })).toBe(link);
    expect(webViewLinkOf({ meta: null, source_meta: null })).toBeNull();
    expect(pageUnitFor({ webViewLink: webViewLinkOf({ meta: { web_view_link: link } }) })).toBe(
      "slide",
    );
  });
});

describe("pass 101.1: the lasso names the instance it circled", () => {
  it("counts the occurrence at the enclosed run, not the whole page", async () => {
    const { joinRuns, occurrenceAtOffset } = await import("@/components/provenance/SlidesPane");
    const page = joinRuns([
      { text: "Margin held", x: 0, y: 0, w: 100, h: 10 },
      { text: "other words", x: 0, y: 20, w: 100, h: 10 },
      { text: "Margin held", x: 0, y: 40, w: 100, h: 10 },
    ]);
    const first = page.offsets[0] as number;
    const second = page.offsets[2] as number;
    expect(occurrenceAtOffset(page, "Margin held", first)).toBe(1);
    expect(occurrenceAtOffset(page, "Margin held", second)).toBe(2);
  });
});

describe("pass 101.1: stitches cross the view boundary", () => {
  it("re-anchors a text view stitch onto the page that holds its wording", async () => {
    const { anchorStitches, joinRuns } = await import("@/components/provenance/SlidesPane");
    const pages = new Map([
      [1, joinRuns([{ text: "Opening remarks", x: 0, y: 0, w: 90, h: 10 }])],
      [2, joinRuns([{ text: "Margin held at nineteen percent", x: 0, y: 0, w: 200, h: 10 }])],
    ]);
    const make = (id: string, snippet: string) =>
      ({
        id,
        status: "exact",
        locator: { unit: "section", index: 7, snippet, occurrence: 1 },
      }) as never;
    const { anchors, orphans } = anchorStitches(pages, [
      make("s1", "Margin held at nineteen percent"),
      make("s2", "a line that is nowhere on these pages"),
    ]);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.page).toBe(2);
    expect(orphans.map((o) => o.id)).toEqual(["s2"]);
  });
});

describe("pass 101.1: the thread retires", () => {
  it("carries the status colour and calls back when it is done", async () => {
    vi.useFakeTimers();
    const { ThreadLine, THREAD_LIFE_MS } = await import("@/components/provenance/ThreadLine");
    const onDone = vi.fn();
    cleanup();
    render(
      <ThreadLine
        from={{ x: 300, y: 100 }}
        targetId={null}
        sourced={false}
        reduceMotion
        status="exact"
        onDone={onDone}
      />,
    );
    const line = screen.getByTestId("audit-thread").querySelector("line");
    expect(line?.getAttribute("stroke")).toBe("var(--status-exact)");
    expect(line?.getAttribute("stroke-dasharray")).toBe("4 4");
    vi.advanceTimersByTime(THREAD_LIFE_MS + 10);
    expect(onDone).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("pass 101.2: the rendition query stops churning", () => {
  it("keeps the signed url fresh for ten minutes and ignores window focus", async () => {
    const { renditionQueryOptions, RENDITION_STALE_MS } = await import("@/lib/rendition-query");
    expect(RENDITION_STALE_MS).toBe(10 * 60 * 1000);
    expect(renditionQueryOptions.staleTime).toBeGreaterThan(0);
    expect(renditionQueryOptions.refetchOnWindowFocus).toBe(false);
  });

  it("cancels a superseded render and swallows the cancellation", async () => {
    const { makeRenderGuard } = await import("@/lib/rendition-query");
    const cancel = vi.fn();
    const guard = makeRenderGuard();
    guard.set({ cancel });
    guard.cancel();
    expect(cancel).toHaveBeenCalledTimes(1);
    guard.cancel();
    expect(cancel).toHaveBeenCalledTimes(1);

    const throwing = makeRenderGuard();
    throwing.set({
      cancel: () => {
        throw new Error("RenderingCancelledException");
      },
    });
    expect(() => throwing.cancel()).not.toThrow();
  });
});
