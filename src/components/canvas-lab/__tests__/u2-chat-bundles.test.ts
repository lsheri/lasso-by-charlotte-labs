import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { bundleCountBand, chatBundles, dockBundles, dockedPieceChats, type BundleItem } from "@/components/canvas-lab/canvas-lab-model";

const chat = (id: string, owner = "p1", conv = "c1"): BundleItem => ({ id, type: "ai_thread", owner_id: owner, orig_conversation_id: conv });
const piece = (id: string, extra: Partial<BundleItem> = {}): BundleItem => ({
  id,
  type: "document",
  owner_id: "p1",
  orig_conversation_id: "c1",
  source_meta: { role: "attachment" },
  ...extra,
});
const n = (id: string) => ({ id: `n-${id}`, workItemId: id });

describe("chatBundles", () => {
  it("groups two pieces of the same conversation and leaves another conversation out", () => {
    const items = [chat("t"), piece("a"), piece("b"), piece("x", { orig_conversation_id: "c2" })];
    const result = chatBundles([n("t"), n("a"), n("b"), n("x")], items);
    expect([...result]).toEqual([["n-t", ["n-a", "n-b"]]]);
  });

  it("ignores a piece from a different owner with the same conversation id", () => {
    const result = chatBundles([n("t"), n("a")], [chat("t"), piece("a", { owner_id: "p2" })]);
    expect(result.size).toBe(0);
  });

  it("ignores an ungrouped piece", () => {
    const result = chatBundles([n("t"), n("a")], [chat("t"), piece("a", { ungrouped_at: "2026-09-01" })]);
    expect(result.size).toBe(0);
  });

  it("ignores a hidden piece and a piece that is not an attachment", () => {
    const items = [chat("t"), piece("a"), piece("b", { source_meta: { role: "primary" } })];
    expect(chatBundles([n("t"), n("a"), n("b")], items, ["n-a"]).size).toBe(0);
  });

  it("orders by produced turn, then by creation time", () => {
    const items = [
      chat("t"),
      piece("late", { created_at_source: "2026-09-03" }),
      piece("early", { created_at_source: "2026-09-01" }),
      piece("turn9", { source_meta: { role: "attachment", produced_at_turn: 9 } }),
      piece("turn2", { source_meta: { role: "attachment", produced_at_turn: 2 } }),
    ];
    const result = chatBundles(["t", "late", "early", "turn9", "turn2"].map(n), items);
    expect(result.get("n-t")).toEqual(["n-turn2", "n-turn9", "n-early", "n-late"]);
  });

  it("gives a piece to one chat only", () => {
    const result = chatBundles([n("t"), n("t2"), n("a")], [chat("t"), chat("t2"), piece("a")]);
    expect(dockedPieceChats(result).get("n-a")).toBe("n-t");
    expect(result.size).toBe(1);
  });
});

describe("dockBundles", () => {
  it("stacks pieces below the chat, indented 24px, 18px apart, ignoring stored positions", () => {
    const nodes = [
      { id: "c", x: 100, y: 200, height: 180 },
      { id: "p1", x: 900, y: 900, height: 120 },
      { id: "p2", x: 0, y: 0, height: 150 },
      { id: "free", x: 5, y: 5, height: 100 },
    ];
    const out = dockBundles(nodes, new Map([["c", ["p1", "p2"]]]));
    expect(out.find((node) => node.id === "p1")).toMatchObject({ x: 124, y: 398 });
    expect(out.find((node) => node.id === "p2")).toMatchObject({ x: 124, y: 536 });
    expect(out.find((node) => node.id === "free")).toMatchObject({ x: 5, y: 5 });
    expect(out.find((node) => node.id === "c")).toMatchObject({ x: 100, y: 200 });
  });

  it("bands the bundle count", () => {
    expect([0, 1, 2, 7].map(bundleCountBand)).toEqual(["0", "1", "2_plus", "2_plus"]);
  });
});

describe("board wiring", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  it("redirects a docked piece's drag and keyboard move to its chat", () => {
    expect(page).toContain("function onCardPointerDown(picked: LabNode, event: React.PointerEvent) {\n    // A docked piece is carried by its chat: the drag moves the chat.\n    const node = bundleChatFor(picked);");
    expect(page).toMatch(/function onCardKeyDown\(picked: LabNode[^\n]*\n\s*const node = \[[^\n]*bundleChatFor\(picked\)/);
  });
  it("docks in the visibleNodes memo and turns resize off on pieces", () => {
    expect(page).toContain("const visibleNodes = useMemo(() => dockBundles(shownNodes, bundles), [shownNodes, bundles]);");
    expect(page).toContain("const canResize = !bundleChatId &&");
  });
});
