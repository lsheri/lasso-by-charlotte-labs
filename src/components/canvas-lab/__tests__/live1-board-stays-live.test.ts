import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { BOARD_LIVE_TABLES, boardRowIds, knownVersions, liveBoardChanged, liveRowIsNew } from "@/components/canvas-lab/board-live";
import type { LabFrame, LabLink, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { WORKBOARD_EVENT_DIMS } from "@/lib/workboard-event-allowlist";

const node = (durableId: string, durableVersion: number) => ({ id: `local:${durableId}`, kind: "sticky", durableId, durableVersion }) as unknown as LabNode;
const frame = (durableId: string, durableVersion: number) => ({ id: `f:${durableId}`, name: "S", durableId, durableVersion }) as unknown as LabFrame;
const link = (durableId: string, durableVersion: number) => ({ id: `l:${durableId}`, fromId: "a", toId: "b", fromAnchor: "right", toAnchor: "left", durableId, durableVersion }) as LabLink;
const dto = (nodes: [string, number][], frames: [string, number][] = [], links: [string, number][] = []) => ({
  nodes: nodes.map(([id, version]) => ({ id, version })),
  frames: frames.map(([id, version]) => ({ id, version })),
  links: links.map(([id, version]) => ({ id, version })),
}) as never;

describe("LIVE-1 what counts as a change", () => {
  const known = knownVersions([node("n1", 2), { id: "painted", kind: "image" } as LabNode], [frame("f1", 1)], [link("l1", 3)]);

  it("knows only saved rows, never painted or seeded pieces", () => {
    expect([...known.entries()].sort()).toEqual([["f1", 1], ["l1", 3], ["n1", 2]]);
  });

  it("ignores an echo of a version the board already holds", () => {
    expect(liveRowIsNew({ id: "n1", version: 2 }, known)).toBe(false);
    expect(liveRowIsNew({ id: "n1", version: 1 }, known)).toBe(false);
    expect(liveRowIsNew({ id: "n1", version: 3 }, known)).toBe(true);
    expect(liveRowIsNew({ id: "new", version: 1 }, known)).toBe(true);
    expect(liveRowIsNew(null, known)).toBe(false);
  });

  it("a fresh read changes the board only when a row is newer, new, or gone", () => {
    const seen = new Set(["n1", "f1", "l1", "skipped-draft"]);
    expect(liveBoardChanged(dto([["n1", 2], ["skipped-draft", 4]], [["f1", 1]], [["l1", 3]]), known, seen)).toBe(false);
    expect(liveBoardChanged(dto([["n1", 3]], [["f1", 1]], [["l1", 3]]), known, seen)).toBe(true);
    expect(liveBoardChanged(dto([["n1", 2], ["n9", 1]], [["f1", 1]], [["l1", 3]]), known, seen)).toBe(true);
    expect(liveBoardChanged(dto([], [["f1", 1]], [["l1", 3]]), known, seen)).toBe(true);
  });

  it("collects every row id of a board read", () => {
    expect([...boardRowIds(dto([["n1", 1]], [["f1", 1]], [["l1", 1]]))].sort()).toEqual(["f1", "l1", "n1"]);
  });
});

describe("LIVE-1 wiring", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const hook = readFileSync("src/components/canvas-lab/board-live.ts", "utf8");
  const lab = readFileSync("src/hooks/use-canvas-lab.ts", "utf8");

  it("streams the board's own rows and never margin notes", () => {
    expect([...BOARD_LIVE_TABLES]).toEqual(["workboard_nodes", "workboard_frames", "workboard_links"]);
    expect(hook).toMatch(/filter: `workboard_id=eq\.\$\{boardId\}`/);
    expect(hook).not.toMatch(/"workboard_annotations"/);
    const sql = readFileSync("supabase/migrations/20261108160000_live1_board_rows_in_realtime.sql", "utf8");
    expect(sql).toMatch(/alter publication supabase_realtime add table public\.workboard_nodes, public\.workboard_frames, public\.workboard_links;/);
    expect(sql).not.toMatch(/add table[^;]*annotations/);
  });

  it("resyncs on reconnect, coming back online and returning to the tab", () => {
    expect(hook).toMatch(/schedule\(channelDown \? "reconnect" : "change"\)/);
    expect(hook).toMatch(/addEventListener\("online", onOnline\)/);
    expect(hook).toMatch(/visibilityState === "visible"\) schedule\("focus"\)/);
    expect(hook).toMatch(/removeChannel\(channel\)/);
  });

  it("holds while the person is mid-gesture, saving, typing on the board, or facing a conflict", () => {
    const busy = page.slice(page.indexOf("function liveBusy()"), page.indexOf("function liveBusy()") + 700);
    expect(busy).toMatch(/interactionRef\.current !== "idle"/);
    expect(busy).toMatch(/lab\.isSaving\(\)/);
    expect(busy).toMatch(/saveState\.status === "conflict"/);
    expect(busy).toMatch(/data-editing='true'/);
    expect(lab).toMatch(/inFlightRef\.current > 0 \|\| Date\.now\(\) - settledAtRef\.current < quietMs/);
  });

  it("applies through the board read, keeps undo, and re-checks busy after the read", () => {
    const apply = page.slice(page.indexOf("async function applyLiveBoard"), page.indexOf("function liveBusy()"));
    expect(apply).toMatch(/await lab\.refresh\(\)/);
    expect(apply).toMatch(/if \(liveBusy\(\)\) return false;/);
    expect(apply).toMatch(/applyDurableBoard\(base, fresh\)/);
    expect(apply).not.toMatch(/undoRef\.current = |setUndoToast|clearSaveState/);
  });

  it("Load latest and live reads always go to the server, never a cached copy", () => {
    expect(lab).toMatch(/fetchQuery\(\{ \.\.\.canvasLabBoardQuery\(engagementId, profileId\), staleTime: 0, retry: 1 \}\)/);
  });

  it("the live event is content-free", () => {
    expect(WORKBOARD_EVENT_DIMS["workboard.live_applied"]).toEqual(["trigger"]);
  });
});
