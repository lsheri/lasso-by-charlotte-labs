// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LassoLayer, TRY_AGAIN_TITLE } from "@/components/provenance/LassoLayer";
import { StitchTabs, DELETE_CONFIRM_LINE } from "@/components/provenance/StitchTabs";
import {
  highlightRects,
  inkUnderglows,
  type StitchAnchor,
} from "@/components/provenance/SlidesPane";
import { deleteSpanLinkRow } from "@/lib/span-link-delete.server";
import {
  MAX_INK_POINTS,
  decimatePath,
  denormalizeInk,
  isDegenerateLasso,
  normalizeInk,
} from "@/lib/lasso-geometry";
import { validInkForTest } from "@/lib/span-provenance.functions";
import {
  pickResolvedStitch,
  runResolveChoreography,
  stitchTabLabel,
  tabsNewestFirst,
} from "@/lib/span-replay";
import {
  TRACE_UNAVAILABLE_LINE,
  handleTrace,
  readTraceId,
  stripTraceParam,
} from "@/lib/trace-link";
import type { AuditStitch } from "@/lib/span-provenance.functions";

afterEach(cleanup);

function stitch(over: Partial<AuditStitch> = {}): AuditStitch {
  return {
    id: "s1",
    status: "exact",
    question: "Where did this come from?",
    quote: null,
    answer: null,
    to_item_id: "item-1",
    to_item_title: "Kickoff notes",
    to_turn_id: null,
    to_turn_no: null,
    created_at: "2026-01-01T00:00:00.000Z",
    locator: { unit: "page", index: 1, snippet: "The margin held at nineteen percent" },
    ...over,
  } as AuditStitch;
}

describe("pass 105: the ink is stored as ink", () => {
  it("decimates to at most eighty points and keeps the ends", () => {
    const drawn = Array.from({ length: 400 }, (_, i) => ({ x: i, y: i * 2 }));
    const cut = decimatePath(drawn);
    expect(cut.length).toBe(MAX_INK_POINTS);
    expect(cut[0]).toEqual({ x: 0, y: 0 });
    expect(cut[cut.length - 1]).toEqual({ x: 399, y: 798 });
  });

  it("normalizes to 0..1 and back to the page it is drawn on", () => {
    const ink = normalizeInk(
      [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
        { x: 200, y: 100 },
      ],
      200,
      100,
    );
    expect(ink).toEqual([
      [0, 0],
      [0.5, 0.5],
      [1, 1],
    ]);
    expect(denormalizeInk(ink, 400, 200)[1]).toEqual({ x: 200, y: 100 });
  });

  it("keeps good ink and drops anything that is not on the page", () => {
    const good = [
      [0, 0],
      [0.5, 0.5],
      [1, 1],
    ];
    expect(validInkForTest(good)).toEqual(good);
    expect(
      validInkForTest([
        [0, 0],
        [2, 0.5],
        [1, 1],
      ]),
    ).toBeNull();
    expect(
      validInkForTest([
        [0, 0],
        ["a", 1],
        [1, 1],
      ]),
    ).toBeNull();
    expect(validInkForTest([[0, 0]])).toBeNull();
    expect(validInkForTest("nope")).toBeNull();
    const long = Array.from({ length: 200 }, (_, i) => [i / 200, 0.5]);
    expect(validInkForTest(long)?.length).toBe(MAX_INK_POINTS);
  });
});

describe("pass 105: replay draws what was drawn", () => {
  const ink: [number, number][] = [
    [0.1, 0.1],
    [0.6, 0.12],
    [0.58, 0.3],
    [0.12, 0.28],
  ];

  it("renders stored ink and an underglow for an inked stitch, and no rect", () => {
    const anchors: StitchAnchor[] = [{ stitch: stitch(), page: 1, start: 0, end: 10, ink }];
    expect(highlightRects(anchors, { runs: [], text: "", offsets: [] }, 100, 100)).toEqual([]);
    const glows = inkUnderglows(anchors, 100, 100);
    expect(glows).toHaveLength(1);
    expect(glows[0]?.d.startsWith("M ")).toBe(true);

    render(
      <LassoLayer
        armed={false}
        runs={[]}
        width={100}
        height={100}
        reduceMotion
        settled={null}
        replays={[{ id: "s1", ink }]}
        resolving={false}
        onLasso={() => {}}
        onEmpty={() => {}}
      />,
    );
    expect(screen.getByTestId("ink-replay-s1")).toBeTruthy();
  });

  it("keeps the box highlight for a stitch with no ink", () => {
    const anchors: StitchAnchor[] = [
      {
        stitch: stitch({ id: "s2" }),
        page: 1,
        start: 0,
        end: 5,
        bbox: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
      },
    ];
    const rects = highlightRects(anchors, { runs: [], text: "", offsets: [] }, 100, 100);
    expect(rects).toHaveLength(1);
    expect(inkUnderglows(anchors, 100, 100)).toEqual([]);
  });
});

describe("pass 105: the resolve opens only what it can", () => {
  it("opens the source for a sourced answer", () => {
    const onFocus = vi.fn();
    const onThread = vi.fn();
    runResolveChoreography(stitch(), { onThread, onFocus });
    expect(onThread).toHaveBeenCalled();
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("opens nothing for an unsourced answer", () => {
    const onFocus = vi.fn();
    runResolveChoreography(stitch({ status: "unsourced", to_item_id: null }), {
      onThread: () => {},
      onFocus,
    });
    expect(onFocus).not.toHaveBeenCalled();
  });

  it("picks the newest answer for the wording just asked about", () => {
    const older = stitch({ id: "old", created_at: "2026-01-01T00:00:00.000Z" });
    const newer = stitch({ id: "new", created_at: "2026-02-01T00:00:00.000Z" });
    expect(pickResolvedStitch([older, newer], "The margin held at nineteen percent")?.id).toBe(
      "new",
    );
    expect(pickResolvedStitch([older, newer], "something else")).toBeNull();
  });
});

describe("pass 105: the tab rail is the history", () => {
  const stitches = [
    stitch({ id: "a", created_at: "2026-01-01T00:00:00.000Z" }),
    stitch({
      id: "b",
      created_at: "2026-03-01T00:00:00.000Z",
      locator: {
        unit: "page",
        index: 1,
        occurrence: 1,
        snippet: "A far longer circled sentence than any tab could carry",
      },
    }),
  ] as AuditStitch[];

  it("names a tab from the circled wording and lists newest first", () => {
    expect(tabsNewestFirst(stitches)[0]?.id).toBe("b");
    expect(stitchTabLabel(stitches[1]!)).toBe("A far longer circled sentenc…");
  });

  it("replays on click and deletes behind one confirm for the owner", () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    render(
      <StitchTabs
        stitches={stitches}
        activeId={null}
        canDelete
        onSelect={onSelect}
        onNew={() => {}}
        onCopyLink={() => {}}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByTestId("stitch-tab-b"));
    expect(onSelect).toHaveBeenCalledWith(stitches[1]);

    fireEvent.click(screen.getByTestId("stitch-tab-menu-a"));
    fireEvent.click(screen.getByTestId("stitch-tab-delete-a"));
    expect(screen.getByText(DELETE_CONFIRM_LINE)).toBeTruthy();
    fireEvent.click(
      screen.getByTestId("stitch-tab-confirm-a").querySelector("button") as HTMLElement,
    );
    expect(onDelete).toHaveBeenCalledWith(stitches[0]);
  });

  it("offers no delete to a coach", () => {
    render(
      <StitchTabs
        stitches={stitches}
        activeId={null}
        canDelete={false}
        onSelect={() => {}}
        onNew={() => {}}
        onCopyLink={() => {}}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("stitch-tab-menu-a"));
    expect(screen.queryByTestId("stitch-tab-delete-a")).toBeNull();
    expect(screen.getByTestId("stitch-tab-copy-a")).toBeTruthy();
  });
});

describe("pass 105: removing one traced question", () => {
  function client(rows: Record<string, unknown>, deleted: string[]) {
    return {
      from(table: string) {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: (rows[table] as Record<string, unknown>)?.[value] ?? null,
                error: null,
              }),
            }),
          }),
          delete: () => ({
            eq: async (_column: string, value: string) => {
              deleted.push(`${table}:${value}`);
              return { error: null };
            },
          }),
        };
      },
    } as never;
  }

  const rows = {
    span_links: { link1: { id: "link1", from_item_id: "item-1" } },
    work_items: { "item-1": { id: "item-1", owner_id: "owner" } },
  };

  it("deletes exactly one row for the owner of the circled work", async () => {
    const deleted: string[] = [];
    const result = await deleteSpanLinkRow(client(rows, deleted), client(rows, deleted), {
      spanLinkId: "link1",
      profileId: "owner",
    });
    expect(result).toEqual({ deleted: 1, from_item_id: "item-1" });
    expect(deleted).toEqual(["span_links:link1"]);
  });

  it("refuses anyone who does not own the anchor", async () => {
    const deleted: string[] = [];
    await expect(
      deleteSpanLinkRow(client(rows, deleted), client(rows, deleted), {
        spanLinkId: "link1",
        profileId: "someone-else",
      }),
    ).rejects.toBeInstanceOf(Response);
    expect(deleted).toEqual([]);
  });
});

describe("pass 105: the shared trace link", () => {
  it("reads and strips the parameter", () => {
    expect(readTraceId("?trace=abc")).toBe("abc");
    expect(readTraceId("?other=1")).toBeNull();
    expect(stripTraceParam("/engagements/e1?trace=abc&tab=work")).toBe("/engagements/e1?tab=work");
    expect(stripTraceParam("/engagements/e1?trace=abc")).toBe("/engagements/e1");
  });

  it("opens the audit when the row is readable", async () => {
    const open = vi.fn();
    const onUnavailable = vi.fn();
    const ok = await handleTrace({
      stitchId: "link1",
      engagementId: "e1",
      fetchStitch: async () => ({ id: "link1", from_item_id: "item-1", anchor_title: "Deck" }),
      open,
      onUnavailable,
    });
    expect(ok).toBe(true);
    expect(open).toHaveBeenCalledWith({
      anchorId: "item-1",
      anchorTitle: "Deck",
      engagementId: "e1",
      initialStitchId: "link1",
    });
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it("says so plainly when the row is not the reader's to see", async () => {
    const open = vi.fn();
    const onUnavailable = vi.fn();
    const ok = await handleTrace({
      stitchId: "link1",
      engagementId: "e1",
      fetchStitch: async () => null,
      open,
      onUnavailable,
    });
    expect(ok).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledWith(TRACE_UNAVAILABLE_LINE);
  });
});

describe("pass 105: a loop that caught nothing", () => {
  it("is degenerate when it is a flick or a speck", () => {
    expect(
      isDegenerateLasso(
        [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
        100,
        100,
      ),
    ).toBe(true);
    const speck = Array.from({ length: 12 }, (_, i) => ({
      x: 50 + i * 0.1,
      y: 50 + (i % 3) * 0.1,
    }));
    expect(isDegenerateLasso(speck, 1000, 1000)).toBe(true);
    const loop = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 40 },
      { x: 40, y: 55 },
      { x: 20, y: 55 },
      { x: 10, y: 40 },
      { x: 4, y: 20 },
      { x: 2, y: 8 },
      { x: 0, y: 2 },
    ];
    expect(isDegenerateLasso(loop, 100, 100)).toBe(false);
  });

  it("shows the try-again card and asks nothing", () => {
    const onLasso = vi.fn();
    render(
      <LassoLayer
        armed
        runs={[]}
        width={300}
        height={300}
        reduceMotion
        settled={null}
        resolving={false}
        onLasso={onLasso}
        onEmpty={() => {}}
      />,
    );
    const layer = screen.getByTestId("lasso-layer");
    fireEvent.pointerDown(layer, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(layer, { clientX: 12, clientY: 12 });
    fireEvent.pointerUp(layer);
    expect(onLasso).not.toHaveBeenCalled();
    expect(screen.getByText(TRY_AGAIN_TITLE)).toBeTruthy();
    fireEvent.click(screen.getByText("Got it"));
    expect(screen.queryByText(TRY_AGAIN_TITLE)).toBeNull();
  });
});
