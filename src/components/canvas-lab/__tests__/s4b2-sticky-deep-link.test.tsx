// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { findStickyPiece, useStickyDeepLink, type StickyTarget } from "@/components/canvas-lab/useStickyDeepLink";

const nodes = [
  { id: "n-answer", kind: "answer", workItemId: "w1" },
  { id: "n1", kind: "work", workItemId: "w1" },
];
const items = [{ id: "w1" }];

describe("S4b-2 which piece a notification opens", () => {
  it("the card showing that work, never an answer about it", () => {
    expect(findStickyPiece(nodes, items, new Set(), "w1")).toEqual({ node: nodes[1], item: items[0] });
  });
  it("waits while the board or the work is still loading", () => {
    expect(findStickyPiece(null, items, new Set(), "w1")).toBe("wait");
    expect(findStickyPiece(nodes, [], new Set(["w1"]), "w1")).toBe("wait");
  });
  it("says so when the work has left the board", () => {
    expect(findStickyPiece(nodes, items, new Set(), "w9")).toBe("gone");
    expect(findStickyPiece(nodes, [], [], "w1")).toBe("gone");
  });
});

describe("S4b-2 opening it", () => {
  it("opens once per click, and again for a new click on the same sticky", () => {
    const open = vi.fn();
    const gone = vi.fn();
    const first: StickyTarget = { stickyId: "s1", workItemId: "w1", at: 1 };
    const { rerender } = renderHook((props: { target: StickyTarget; list: typeof nodes | null }) =>
      useStickyDeepLink({ target: props.target, nodes: props.list, items, pendingIds: [], open, gone }),
      { initialProps: { target: first, list: null as typeof nodes | null } });
    expect(open).not.toHaveBeenCalled();
    rerender({ target: first, list: nodes });
    rerender({ target: first, list: [...nodes] });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(nodes[1], items[0], "s1");
    rerender({ target: { ...first, at: 2 }, list: nodes });
    expect(open).toHaveBeenCalledTimes(2);
    expect(gone).not.toHaveBeenCalled();
  });
  it("tells the person when the work is gone, once", () => {
    const gone = vi.fn();
    renderHook(() =>
      useStickyDeepLink({ target: { stickyId: "s1", workItemId: "w9", at: 1 }, nodes, items, pendingIds: [], open: vi.fn(), gone }),
    );
    expect(gone).toHaveBeenCalledTimes(1);
  });
});

describe("S4b-2 wiring (pinned in source)", () => {
  it("the route takes the sticky and its work, hands them to the board, then cleans the address", () => {
    const route = readFileSync("src/routes/_authenticated/engagements.$id_.canvas-lab.tsx", "utf8");
    expect(route).toContain('sticky: fallback(z.string(), "").default(""),');
    expect(route).toContain("setOpenSticky({ stickyId: sticky, workItemId: work, at: Date.now() });");
    expect(route).toContain("openSticky={openSticky}");
  });
  it("the board opens the piece on its Stickies tab and records it came from a notification", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain('liftCard(node, item, cardRect(node.id), "stickies"); setStickyFocus({ stickyId, at: Date.now(), for: item.id }); noteWorkboardStickyOpened(orgId, "notification");');
    // The sticky opens only on the piece it belongs to.
    expect(page).toContain("focus: stickyFocus && stickyFocus.for === liftedItem?.id ? stickyFocus : null");
  });
});
