// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));

import { logEvent } from "@/lib/telemetry";
import { anchorElement, spotAt } from "@/lib/sticky-anchors";
import {
  anchorColumns,
  anchorFromRow,
  clampUnit,
  stickyPlace,
  validateStickyAnchor,
  validateStickyBody,
  type StickyAnchor,
} from "@/lib/stickies-shared";
import { WORKBOARD_EVENT_DIMS, guardWorkboardEvent } from "@/lib/workboard-event-allowlist";
import * as helpers from "@/components/canvas-lab/canvas-lab-telemetry";

afterEach(() => {
  document.body.innerHTML = "";
  vi.mocked(logEvent).mockClear();
});

describe("S2a a sticky's spot", () => {
  it("every anchor writes only its own columns and reads back the same", () => {
    const anchors: StickyAnchor[] = [
      { kind: "page", pageNo: 3 },
      { kind: "turn", turnNo: 12 },
      { kind: "section", sectionKey: "Risks" },
      { kind: "row", rowKey: "5" },
      { kind: "media" },
      { kind: "item" },
    ];
    for (const anchor of anchors) expect(anchorFromRow(anchorColumns(anchor))).toEqual(anchor);
    expect(anchorColumns({ kind: "page", pageNo: 3 })).toEqual({
      anchor_kind: "page",
      page_no: 3,
      turn_no: null,
      section_key: null,
      row_key: null,
    });
  });
  it("a spot has to name itself", () => {
    expect(validateStickyAnchor({ kind: "page", pageNo: 0 })).not.toBeNull();
    expect(validateStickyAnchor({ kind: "section", sectionKey: "  " })).not.toBeNull();
    expect(validateStickyAnchor({ kind: "turn", turnNo: 4 })).toBeNull();
    expect(validateStickyAnchor(null)).not.toBeNull();
  });
  it("says where it is the way a person would: a deck has slides", () => {
    expect(stickyPlace({ kind: "page", pageNo: 3 }, "deck")).toBe("Slide 3");
    expect(stickyPlace({ kind: "page", pageNo: 3 }, "pdf")).toBe("Page 3");
    expect(stickyPlace({ kind: "turn", turnNo: 12 })).toBe("Turn 12");
    expect(stickyPlace({ kind: "section", sectionKey: "Risks" })).toBe("Risks");
    expect(stickyPlace({ kind: "row", rowKey: "5" })).toBe("Row 5");
    expect(stickyPlace({ kind: "item" })).toBe("On this piece");
  });
  it("words are required and capped; positions stay inside the spot", () => {
    expect(validateStickyBody("   ")).not.toBeNull();
    expect(validateStickyBody("x".repeat(4001))).not.toBeNull();
    expect(validateStickyBody("Source the 24")).toBeNull();
    expect([clampUnit(-1), clampUnit(2), clampUnit(Number.NaN)]).toEqual([0, 1, 0.5]);
  });
});

function box(el: HTMLElement, left: number, top: number, width: number, height: number) {
  el.getBoundingClientRect = () =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe("S2a finding the spot under a drop, and finding it again", () => {
  it("a slide, a turn and a row are their own spots, with the position inside them", () => {
    document.body.innerHTML = `<div id="root"><div data-anchor-page="2" id="s2"><p id="in">x</p></div><div data-turn-no="7" id="t7"></div><table><tbody><tr data-anchor-row="5" id="r5"><td id="cell">y</td></tr></tbody></table></div>`;
    const root = document.getElementById("root")!;
    box(root, 0, 0, 1000, 2000);
    box(document.getElementById("s2")!, 100, 100, 400, 200);
    box(document.getElementById("t7")!, 0, 400, 800, 100);
    box(document.getElementById("r5")!, 0, 600, 1000, 30);
    expect(spotAt(document.getElementById("in"), root, 300, 150)).toMatchObject({
      anchor: { kind: "page", pageNo: 2 },
      posX: 0.5,
      posY: 0.25,
    });
    expect(spotAt(document.getElementById("t7"), root, 400, 450)?.anchor).toEqual({
      kind: "turn",
      turnNo: 7,
    });
    expect(spotAt(document.getElementById("cell"), root, 10, 610)?.anchor).toEqual({
      kind: "row",
      rowKey: "5",
    });
    expect(anchorElement(root, { kind: "page", pageNo: 2 })?.id).toBe("s2");
  });
  it("in a doc, the spot is the section above the drop; above the first heading it is the whole piece", () => {
    document.body.innerHTML = `<div id="root"><div data-anchor-doc id="doc"><h4 data-anchor-section="Why now" id="h1"></h4><p id="p1"></p><h4 data-anchor-section="Risks" id="h2"></h4><p id="p2"></p></div></div>`;
    const root = document.getElementById("root")!;
    box(root, 0, 0, 800, 1200);
    box(document.getElementById("doc")!, 50, 0, 700, 1200);
    box(document.getElementById("h1")!, 50, 200, 700, 20);
    box(document.getElementById("h2")!, 50, 600, 700, 20);
    expect(spotAt(document.getElementById("p2"), root, 300, 700)?.anchor).toEqual({
      kind: "section",
      sectionKey: "Risks",
    });
    expect(spotAt(document.getElementById("p1"), root, 300, 300)?.anchor).toEqual({
      kind: "section",
      sectionKey: "Why now",
    });
    expect(spotAt(document.getElementById("doc"), root, 300, 100)?.anchor).toEqual({
      kind: "item",
    });
  });
  it("a spot that left the work is not found, so the sticky says its spot changed instead of moving", () => {
    document.body.innerHTML = `<div id="root"><div data-anchor-page="1"></div><div data-anchor-doc><h4 data-anchor-section="Risks"></h4></div></div>`;
    const root = document.getElementById("root")!;
    expect(anchorElement(root, { kind: "page", pageNo: 9 })).toBeNull();
    expect(anchorElement(root, { kind: "section", sectionKey: "Pricing" })).toBeNull();
    expect(anchorElement(root, { kind: "section", sectionKey: "Risks" })).not.toBeNull();
    expect(anchorElement(root, { kind: "item" })).toBe(root);
  });
  it("a drop outside the work is no spot", () => {
    document.body.innerHTML = `<div id="root"></div><div id="away"></div>`;
    expect(
      spotAt(document.getElementById("away"), document.getElementById("root")!, 0, 0),
    ).toBeNull();
  });
});

describe("S2a events: where and on what, never who", () => {
  it("each sticky event carries exactly its allowed dims", () => {
    helpers.noteWorkboardStickyCreated("o", {
      anchor_kind: "page",
      work_kind: "deck",
      assigned: false,
      visibility: "board",
    });
    helpers.noteWorkboardStickyRemoved("o", "turn");
    helpers.noteWorkboardStickyOpened("o", "pin");
    for (const [name, , dims] of vi.mocked(logEvent).mock.calls as [
      string,
      string,
      Record<string, unknown>,
    ][]) {
      expect(guardWorkboardEvent(name, dims as never)).toEqual({ keep: true, dims });
      expect(Object.keys(dims).join(" ")).not.toMatch(
        /profile|author|assignee|user|who|duration|ms/,
      );
    }
    expect(WORKBOARD_EVENT_DIMS["workboard.sticky_created"]).toEqual([
      "anchor_kind",
      "work_kind",
      "assigned",
      "visibility",
    ]);
  });
});

describe("S2a the server (pinned in source)", () => {
  const server = readFileSync("src/lib/stickies.server.ts", "utf8");
  it("reads and writes as the caller, so row policies decide", () => {
    expect(server).not.toMatch(/service_role|supabaseAdmin|createAdminClient/);
  });
  it("only the author changes, moves or removes a sticky", () => {
    expect(server.match(/\.eq\("author_profile_id", profile\.id\)/g)?.length).toBe(2);
  });
  it("only stickies: never a comment or a highlight", () => {
    expect(server.match(/\.eq\("kind", "sticky"\)/g)?.length).toBe(3);
    expect(server).toContain('kind: "sticky",');
  });
  it("a just-me sticky drops any assignee", () => {
    expect(server).toContain(
      'if (patch.visibility === "just_me") patch.assignee_profile_id = null;',
    );
  });
  it("slides, doc sections and sheet rows are marked as spots in the work", () => {
    const preview = readFileSync("src/design/reference/RealPreview.tsx", "utf8");
    expect(preview).toContain("data-anchor-page={n + 1}");
    expect(preview).toContain("data-anchor-section={b.text}");
    expect(preview).toContain("data-anchor-row={r + 1}");
    expect(preview).toContain('data-anchor-doc=""');
  });
});
