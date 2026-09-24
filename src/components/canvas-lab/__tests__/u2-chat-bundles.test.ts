import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { bundleCountBand, bundlePiecesByChat, chatBundles, createLabFrames, dockBundles, dockedPieceChats, seedBlankCanvas, seedCanvas, type BundleItem, type LabNode, type SeedInput } from "@/components/canvas-lab/canvas-lab-model";

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
  it("keeps keyboard state on the pressed piece while the drag carries its chat", () => {
    expect(page).toContain("setKeyboardId(picked.id);");
    expect(page).toContain("dragRef.current = { id: node.id");
  });
});

describe("page-shaped read (Pass A.2)", () => {
  it("the engagement page select carries the bundle columns", () => {
    const src = readFileSync("src/lib/engagement-page.server.ts", "utf8");
    expect(src).toContain("work_items(id, owner_id, orig_conversation_id, ungrouped_at,");
  });
  it("builds workItems like the page and forms one bundle", () => {
    const conv = "u5-verify-2026-09-24";
    const owner = "owner-1";
    const page = {
      tasks: [{
        id: "task-1",
        work_item_tasks: [
          { work_items: { id: "c393", type: "ai_thread", owner_id: owner, orig_conversation_id: conv, ungrouped_at: null, source_meta: { role: "transcript" } } },
          { work_items: { id: "0e92", type: "document", owner_id: owner, orig_conversation_id: conv, ungrouped_at: null, source_meta: { role: "attachment" } } },
        ],
      }],
    };
    const byId = new Map<string, BundleItem>();
    for (const task of page.tasks) for (const link of task.work_item_tasks) {
      const item = link.work_items;
      if (item && !byId.has(item.id)) byId.set(item.id, item as BundleItem);
    }
    const result = chatBundles([n("c393"), n("0e92")], [...byId.values()]);
    expect(result.size).toBe(1);
    expect(result.get("n-c393")).toEqual(["n-0e92"]);
  });
});

describe("bundle-aware seed (Pass A.3)", () => {
  const work = (id: string, bundle: BundleItem) => ({ id, title: id, typeLabel: "x", source: "s", ownedByViewer: true, taskIds: ["t1"], deliverable: false, bundle });
  const input = {
    brief: null,
    tasks: [{ id: "t1", name: "Stream", detail: null, ownedByViewer: true }],
    work: [
      work("A", chat("A", "p1", "cA")),
      work("a1", piece("a1", { orig_conversation_id: "cA", source_meta: { role: "attachment", produced_at_turn: 1 } })),
      work("a2", piece("a2", { orig_conversation_id: "cA", source_meta: { role: "attachment", produced_at_turn: 2 } })),
      work("B", chat("B", "p1", "cB")),
      work("C", chat("C", "p1", "cC")),
    ],
    decisions: [],
  };
  const hit = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const noOverlap = (nodes: LabNode[]) => {
    for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
      expect(hit(nodes[i]!, nodes[j]!), `${nodes[i]!.id} vs ${nodes[j]!.id}`).toBe(false);
    }
  };
  const items = input.work.map((w) => w.bundle);

  it("bundlePiecesByChat uses the chatBundles rules", () => {
    expect([...bundlePiecesByChat(items)]).toEqual([["A", ["a1", "a2"]]]);
  });
  for (const [label, seed] of [["framed", (i: SeedInput) => seedCanvas(i, createLabFrames(i.tasks))], ["blank", seedBlankCanvas]] as const) {
    it(`${label}: after docking, no card overlaps another`, () => {
      const seeded = seed(input);
      const docked = dockBundles(seeded, chatBundles(seeded, items));
      noOverlap(docked);
    });
  }
  it("a seeded piece never gets its own slot", () => {
    const withPieces = seedCanvas(input, createLabFrames(input.tasks));
    const without = seedCanvas({ ...input, work: input.work.filter((w) => !w.id.startsWith("a")) }, createLabFrames(input.tasks));
    const at = (nodes: LabNode[], id: string) => nodes.find((node) => node.id === `work:${id}`)!;
    // B takes the slot right after A, as if the pieces were not there.
    expect([at(withPieces, "B").x, at(withPieces, "B").y]).toEqual([at(without, "B").x, at(without, "B").y]);
  });
});
