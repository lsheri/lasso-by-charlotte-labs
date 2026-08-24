// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_LASSO_LINE, LassoLayer } from "@/components/provenance/LassoLayer";
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

function drawLasso(polygon: { x: number; y: number }[]) {
  const layer = screen.getByTestId("lasso-layer");
  const first = polygon[0] as { x: number; y: number };
  fireEvent.pointerDown(layer, { clientX: first.x, clientY: first.y });
  polygon.slice(1).forEach((point) => {
    fireEvent.pointerMove(layer, { clientX: point.x, clientY: point.y });
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
        wrapped={null}
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
    expect(screen.getByText(EMPTY_LASSO_LINE)).toBeTruthy();
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
        wrapped={null}
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
  function wrap(reduceMotion: boolean) {
    cleanup();
    render(
      <LassoLayer
        armed
        runs={runs}
        width={300}
        height={300}
        reduceMotion={reduceMotion}
        wrapped={{ x: 10, y: 10, w: 200, h: 20 }}
        resolving
        onLasso={() => {}}
        onEmpty={() => {}}
      />,
    );
    return screen.getByTestId("lasso-wrap").getAttribute("class") ?? "";
  }

  it("drops the shrink wrap animation and the dash march", () => {
    expect(wrap(false)).toContain("nb-lasso-wrap");
    expect(wrap(false)).toContain("nb-lasso-resolving");
    const still = wrap(true);
    expect(still).toContain("nb-lasso-static");
    expect(still).not.toContain("nb-lasso-wrap");
    expect(still).not.toContain("nb-lasso-resolving ");
  });

  it("draws the thread without animating it", async () => {
    const { ThreadLine } = await import("@/components/provenance/ThreadLine");
    cleanup();
    render(<ThreadLine from={{ x: 300, y: 100 }} targetId={null} sourced={false} reduceMotion />);
    const line = screen.getByTestId("audit-thread").querySelector("line");
    expect(line?.getAttribute("class")).toBe("nb-thread-static");
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
    const mod = (await import("@/lib/span-provenance.functions")) as unknown as Record<
      string,
      unknown
    >;
    void mod;
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
          mime_type:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
