// @vitest-environment jsdom
/**
 * P1: the board shell, the lane, and the guard against the two drifting.
 *
 * WHY THE DRIFT GUARD EXISTS.
 * BoardShell and CanvasLabPage wire the same board twice: the page was left
 * untouched on purpose, so the two are separate wirings of one set of
 * primitives. Two wirings is the cost of not refactoring the page, and drift
 * is the risk that cost carries. If one side gains a pan or zoom primitive the
 * other lacks, the two boards start behaving differently and nobody finds out
 * from the outside. This guard fails loudly at that moment. It is an addition,
 * and it relaxes nothing.
 */

import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BoardShell } from "@/components/board/BoardShell";
import {
  isLaneFrameId,
  laneContentExtent,
  laneContentLayout,
  laneOverflows,
  laneVisiblePlacements,
  LANE_CONTENT_GAP,
  LANE_FRAME_PREFIX,
  LANE_PADDING,
  newLaneFrameId,
} from "@/lib/board-lane";
import { isRegionFrameId, newRegionFrameId, regionClaims, regionIsPaint, regionIsWorkstream } from "@/lib/board-region";

afterEach(cleanup);

const read = (path: string) => readFileSync(path, "utf8");

/**
 * Named imports from one module. Tolerates a multi-line import block, because
 * a reflow of either file must never quietly turn this guard into a comparison
 * of two empty lists.
 */
function importedNames(source: string, module: string): string[] {
  const match = source.match(new RegExp(`import\\s*\\{([\\s\\S]*?)\\}\\s*from\\s*"${module}"`));
  if (!match) return [];
  return (match[1] ?? "")
    .split(",")
    .map((entry) => entry.replace(/\s+/g, " ").trim().replace(/^type\s+/, ""))
    .filter((entry) => entry.length > 0)
    .sort();
}

/**
 * The primitives neither side of the board may do without. Named here so the
 * requirement is readable rather than inferred from a diff.
 */
const CORE_PAN_ZOOM = ["clampZoom", "scrollableUnder", "wheelPanVector", "zoomAbout"] as const;

describe("the board shell wires the shared primitives", () => {
  const shell = read("src/components/board/BoardShell.tsx");

  it("takes its pan and zoom from the shared modules, never its own maths", () => {
    expect(importedNames(shell, "@/lib/canvas-zoom")).toEqual(
      ["clampZoom", "scrollableUnder", "stepZoom", "wheelPanVector", "workboardPinchZoom", "zoomAbout"],
    );
    expect(importedNames(shell, "@/lib/canvas-drag")).toEqual(["Point", "dragTo", "keyTo"].sort());
    expect(shell).toContain("fitWorkboardViewport");
    expect(shell).toContain('addEventListener("wheel", onSurfaceWheel, { passive: false })');
  });

  it("owns no engagement workboard feature", () => {
    expect(shell).not.toMatch(/canvas-lab-shared|use-canvas-lab|mutateCanvasLabBoardFn|WorkboardDto/);
    expect(shell).not.toMatch(/AddWorkPanel|BoardAsk|BoardDetailsPopover|RegionColourSwatches|GroupingNamePopup/);
    expect(shell).not.toMatch(/canvas-lab-telemetry|supabase/);
  });
});

describe("the shell and the page cannot drift apart", () => {
  const shell = read("src/components/board/BoardShell.tsx");
  const page = read("src/pages/CanvasLabPage.tsx");

  it("uses the identical pan and zoom primitive set on both sides", () => {
    expect(importedNames(shell, "@/lib/canvas-zoom")).toEqual(importedNames(page, "@/lib/canvas-zoom"));
  });

  it("uses the identical drag primitive set on both sides", () => {
    expect(importedNames(shell, "@/lib/canvas-drag")).toEqual(importedNames(page, "@/lib/canvas-drag"));
  });

  it("fits through the one shared fit, on both sides", () => {
    for (const source of [shell, page]) {
      expect(source).toContain("fitWorkboardViewport");
      expect(source).toContain("viewportSizeChanged");
    }
  });
});

describe("a lane is furniture", () => {
  it("keeps an id prefix of its own, which is not a region's", () => {
    const lane = newLaneFrameId("inbox");
    expect(LANE_FRAME_PREFIX).toBe("lane:");
    expect(isLaneFrameId(lane)).toBe(true);
    expect(isRegionFrameId(lane)).toBe(false);
    expect(isLaneFrameId(newRegionFrameId("one"))).toBe(false);
  });

  it("is neither paint nor a workstream, named or not", () => {
    const unnamed = { id: newLaneFrameId("inbox"), label: null };
    const named = { id: newLaneFrameId("inbox"), label: "Recent work" };
    for (const lane of [unnamed, named]) {
      expect(regionIsPaint(lane)).toBe(false);
      expect(regionIsWorkstream(lane)).toBe(false);
    }
  });

  it("claims nothing even with a name on it", () => {
    const lane = { id: newLaneFrameId("inbox"), label: "Recent work" };
    const rect = { x: 0, y: 0, width: 500, height: 500 };
    const cards = [{ id: "card", x: 10, y: 10, width: 100, height: 80, frame: null, workItemId: "w1" }];
    expect(regionClaims(lane, rect, cards)).toEqual({ silent: [], ask: [], frameOnly: [] });
  });
});

describe("a lane lays its contents out and keeps none of it", () => {
  const rect = { x: 40, y: 40, width: 300, height: 200 };
  const contents = [
    { id: "a", height: 100 },
    { id: "b", height: 100 },
    { id: "c", height: 100 },
  ];

  it("derives every position from the index and the lane's rect", () => {
    const placements = laneContentLayout(rect, contents);
    expect(placements.map((placement) => placement.y)).toEqual([
      LANE_PADDING,
      LANE_PADDING + 100 + LANE_CONTENT_GAP,
      LANE_PADDING + 200 + LANE_CONTENT_GAP * 2,
    ]);
    expect(placements.every((placement) => placement.x === LANE_PADDING)).toBe(true);
    expect(placements.every((placement) => placement.width === rect.width - LANE_PADDING * 2)).toBe(true);
    // Reordering the same contents moves them, because index is the layout.
    const reversed = laneContentLayout(rect, [...contents].reverse());
    expect(reversed.map((placement) => placement.id)).toEqual(["c", "b", "a"]);
    expect(reversed.map((placement) => placement.y)).toEqual(placements.map((placement) => placement.y));
  });

  it("clips what runs past its height rather than spilling it", () => {
    expect(laneContentExtent(contents)).toBe(LANE_PADDING * 2 + 300 + LANE_CONTENT_GAP * 2);
    expect(laneOverflows(rect, contents)).toBe(true);
    const placements = laneContentLayout(rect, contents);
    expect(laneVisiblePlacements(rect, placements).map((placement) => placement.id)).toEqual(["a", "b"]);
    expect(laneVisiblePlacements(rect, placements, 140).map((placement) => placement.id)).toEqual(["b", "c"]);
  });

  it("writes no computed position into anything persisted", () => {
    const lane = read("src/lib/board-lane.ts");
    expect(lane).not.toMatch(/supabase|mutate|\.insert\(|\.update\(|localStorage/i);
    const shell = read("src/components/board/BoardShell.tsx");
    const laneBlock = shell.slice(shell.indexOf("lanes.map("), shell.indexOf("boardNodes.map("));
    expect(laneBlock).toContain("laneContentLayout");
    expect(laneBlock).not.toMatch(/onNodeMove|dragTo|persist/);
  });
});

describe("the lane inside the shell", () => {
  const laneId = newLaneFrameId("inbox");
  const frames = [{ id: laneId, x: 0, y: 0, width: 300, height: 260 }];
  const nodes = [
    { id: "a", x: 0, y: 0, width: 260, height: 100, frame: laneId },
    { id: "b", x: 0, y: 0, width: 260, height: 100, frame: laneId },
    { id: "c", x: 0, y: 0, width: 260, height: 100, frame: laneId },
  ];

  function renderShell(onNodeMove?: (id: string, to: { x: number; y: number }) => void) {
    return render(
      <BoardShell
        frames={frames}
        nodes={nodes}
        renderNode={(node) => <span>{node.id.toUpperCase()}</span>}
        {...(onNodeMove ? { onNodeMove } : {})}
      />,
    );
  }

  it("clips its contents inside its own scrolling rect", () => {
    renderShell();
    const scroller = screen.getByTestId(`board-lane-scroll-${laneId}`);
    expect(scroller.className).toContain("overflow-y-auto");
    expect((scroller.firstElementChild as HTMLElement).style.height)
      .toBe(`${LANE_PADDING * 2 + 300 + LANE_CONTENT_GAP * 2}px`);
    expect(screen.getByText("C")).not.toBeNull();
  });

  it("never offers a drag on lane contents", () => {
    const moves: string[] = [];
    renderShell((id) => moves.push(id));
    const content = screen.getByText("A").closest("[data-lane-content]") as HTMLElement;
    fireEvent.pointerDown(content, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(content, { clientX: 120, clientY: 160 });
    fireEvent.pointerUp(content);
    expect(moves).toEqual([]);
  });

  it("leaves the board's pan alone when a lane scrolls", () => {
    renderShell();
    const stage = screen.getByTestId("board-shell-stage") as HTMLElement;
    const before = stage.style.transform;
    const scroller = screen.getByTestId(`board-lane-scroll-${laneId}`);
    // A real lane can scroll, so the wheel belongs to it and never to the board.
    Object.defineProperty(scroller, "scrollHeight", { value: 400, configurable: true });
    Object.defineProperty(scroller, "clientHeight", { value: 260, configurable: true });
    fireEvent.wheel(scroller, { deltaX: 0, deltaY: 60 });
    expect(stage.style.transform).toBe(before);
  });
});
