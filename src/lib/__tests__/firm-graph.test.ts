// 18 Nov: Firm Brain Build Spec, step 2. The firm brain as threads, one per shared engagement, assembled from the
// corpus the firm reader returns and nothing else. The demo firm goes through the same pure steps the live read does:
// seed meta, reader rows, assembleFirmCorpus, then assembleFirmGraph, with no database.
import { describe, expect, it } from "vitest";

import { DEMO_BOARDS } from "@/lib/demo-firm";
import { DEMO_PEOPLE } from "@/lib/demo-firm/people";
import { outcomeLine, seedMeta } from "@/lib/demo-firm/plan";
import type { DemoBoard } from "@/lib/demo-firm/types";
import type { FirmCorpus } from "@/lib/firm-corpus-shared";
import { assembleFirmCorpus, type FirmRows } from "@/lib/firm-corpus.server";
import { assembleFirmGraph, type FirmGraph } from "@/lib/firm-graph-shared";

const UNSHARED = ["b13", "b20", "b23", "b28"];
/** Opaque item ids, as real rows have (uuids), so an item key such as "int-park-gm" cannot look like a person. */
const ITEM_IDS = new Map(DEMO_BOARDS.flatMap((board) => board.items.map((item) => `${board.key}:${item.key}`)).map((key, index) => [key, `item-${index + 1}`]));
const itemId = (board: string, item: string) => ITEM_IDS.get(`${board}:${item}`)!;
const idsOf = (board: string) => new Set([...ITEM_IDS].filter(([key]) => key.startsWith(`${board}:`)).map(([, id]) => id));

/**
 * The rows readFirmCorpus would return for the demo firm, as the seed writes them. The board read asks only for
 * boards shared with the firm; `includeUnsharedItems` adds the unshared boards' items and placements anyway, to prove
 * the assembler drops them without their board.
 */
function demoRows(boards: DemoBoard[] = DEMO_BOARDS, options: { includeUnsharedItems?: boolean } = {}): FirmRows {
  const shared = boards.filter((board) => board.sharedWithFirm);
  const source = options.includeUnsharedItems ? boards : shared;
  const items = source.flatMap((board) => board.items.map((item) => ({ board, item })));
  return {
    boards: shared.map((board) => ({
      id: board.key,
      title: board.title,
      brief: board.brief,
      owner_id: board.team[0]!,
      outcome: outcomeLine(board),
      created_at: `${board.start}T09:00:00Z`,
      clients: { name: board.client.name, quick_folder: false },
    })),
    placements: items
      .filter(({ item }) => item.placed !== false)
      .map(({ board, item }) => ({ work_item_id: itemId(board.key, item.key), engagement_id: board.key })),
    items: items.map(({ board, item }) => ({
      id: itemId(board.key, item.key),
      owner_id: item.author,
      type: item.type,
      title: item.title,
      display_title: null,
      visibility: item.visibility === "private" ? "private" : item.placed === false ? "unmapped" : "mapped",
      work_date: item.date,
      meta: { mime_type: "text/markdown", ...seedMeta(board, item) },
    })),
    extracts: items.map(({ board, item }) => ({
      work_item_id: itemId(board.key, item.key),
      summary: item.summary,
      decisions: item.decisions ?? null,
      entities: item.entities ?? null,
      created_at: `${item.date}T12:00:00Z`,
    })),
    showings: items.flatMap(({ board, item }) =>
      (item.shown ?? []).map((showing) => ({ work_item_id: itemId(board.key, item.key), engagement_id: board.key, shown_on: showing.on, occasion: showing.occasion })),
    ),
    people: DEMO_PEOPLE.map((person) => ({ id: person.key, display_name: person.name, is_guest: false })),
    askerBoards: [],
  };
}

const corpusOf = (rows: FirmRows): FirmCorpus => assembleFirmCorpus("org-kestrel", rows);
const graphOf = (rows: FirmRows): FirmGraph => assembleFirmGraph(corpusOf(rows));
const withItem = (rows: FirmRows, id: string, change: (item: FirmRows["items"][number]) => FirmRows["items"][number]): FirmRows => ({
  ...rows,
  items: rows.items.map((item) => (item.id === id ? change(item) : item)),
});
const withoutItem = (rows: FirmRows, id: string): FirmRows => ({ ...rows, items: rows.items.filter((item) => item.id !== id) });

/** Every key and string value in the graph, for leak checks. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, entry]) => [key, ...strings(entry)]);
  return [];
}

const mentions = (text: string, word: string) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);

describe("the corpus carries the tags", () => {
  it("reads situation, methods, call role and stage off meta for every grade", () => {
    const corpus = corpusOf(demoRows());
    const sow = corpus.items.find((item) => item.id === itemId("b5", "sow"))!;
    expect(sow).toMatchObject({ situation: "new_offering", stage: "reviewed", methods: [] });
    const cfo = corpus.items.find((item) => item.id === itemId("b7", "int-cfo"))!;
    expect(cfo.grade).toBe("summary");
    expect(cfo.role).toBe("chief_financial_officer");
    expect(cfo.methods).toEqual(["stakeholder_interviews"]);
  });
});

describe("the firm graph", () => {
  const rows = demoRows();
  const graph = graphOf(rows);

  it("has one thread per shared engagement, each in the order situation, methods by date, lesson, client deck", () => {
    const shared = DEMO_BOARDS.filter((board) => board.sharedWithFirm);
    expect(graph.threads.map((thread) => thread.id).sort()).toEqual(shared.map((board) => board.key).sort());
    const rank = { situation: 0, method: 1, lesson: 2, client_deck: 3 } as const;
    for (const thread of graph.threads) {
      const kinds = thread.stops.map((stop) => rank[stop.kind]);
      expect(kinds, thread.id).toEqual([...kinds].sort((a, b) => a - b));
      expect(thread.stops.filter((stop) => stop.kind === "situation")).toHaveLength(1);
      const dates = thread.stops.flatMap((stop) => (stop.kind === "method" && stop.date ? [stop.date] : []));
      expect(dates, thread.id).toEqual([...dates].sort());
      const board = shared.find((entry) => entry.key === thread.id)!;
      expect(thread.situation).toBe(board.situation);
      expect(thread.stops.some((stop) => stop.kind === "lesson")).toBe(Boolean(board.outcome));
    }
    const b5 = graph.threads.find((thread) => thread.id === "b5")!;
    expect(b5.stops[0]).toMatchObject({ kind: "situation", situation: "new_offering", itemId: itemId("b5", "sow") });
    expect(b5.stops.find((stop) => stop.kind === "lesson")).toMatchObject({ text: DEMO_BOARDS.find((b) => b.key === "b5")!.outcome!.lesson });
    expect(b5.stops.at(-1)).toMatchObject({ kind: "client_deck", itemIds: [itemId("b5", "proposal"), itemId("b5", "steerco1"), itemId("b5", "final")] });
  });

  it("counts each situation and method by the threads that reach it", () => {
    for (const node of graph.situations) {
      expect(node.threadIds).toEqual(graph.threads.filter((thread) => thread.situation === node.id).map((thread) => thread.id));
    }
    expect(graph.situations.reduce((sum, node) => sum + node.threadIds.length, 0)).toBe(graph.threads.length);
    expect(graph.methods.length).toBeGreaterThan(8);
    for (const node of graph.methods) expect(node.itemCount).toBeGreaterThanOrEqual(node.threadIds.length);
  });

  it("gets nothing from b13, b20, b23 and b28, which are not shared: no thread, no node, no change to any count", () => {
    const without = graphOf(demoRows(DEMO_BOARDS.filter((board) => !UNSHARED.includes(board.key))));
    expect(graph).toEqual(without);
    // Even if their items and placements came back, a board that is not in the shared read takes them out.
    expect(graphOf(demoRows(DEMO_BOARDS, { includeUnsharedItems: true }))).toEqual(graph);
    const all = strings(graph);
    for (const key of UNSHARED) {
      expect(all.some((text) => text === key || idsOf(key).has(text)), key).toBe(false);
      const board = DEMO_BOARDS.find((entry) => entry.key === key)!;
      expect(all.some((text) => text.includes(board.client.name) || text.includes(board.title)), key).toBe(false);
    }
  });

  it("adds nothing for an item set to Out, or a private item", () => {
    // b1's target list is its only outreach work (its outreach email is Out by default).
    const out = withItem(rows, itemId("b1", "target-list"), (item) => ({ ...item, meta: { ...(item.meta as object), firm_memory: "out" } }));
    expect(graphOf(out)).toEqual(graphOf(withoutItem(rows, itemId("b1", "target-list"))));
    expect(graphOf(out).threads.find((thread) => thread.id === "b1")!.stops.some((stop) => stop.kind === "method" && stop.method === "outreach")).toBe(false);
    expect(strings(graphOf(out))).not.toContain(itemId("b1", "target-list"));

    const secret = withItem(rows, itemId("b3", "codesign-notes"), (item) => ({ ...item, visibility: "private" }));
    expect(graphOf(secret)).toEqual(graphOf(withoutItem(rows, itemId("b3", "codesign-notes"))));
    // The seeded private notes carry no tags, but a private item with tags still adds nothing.
    const taggedPrivate = withItem(rows, itemId("b1", "private-notes"), (item) => ({ ...item, meta: { method: ["other"], situation: "pricing" } }));
    expect(graphOf(taggedPrivate)).toEqual(graph);
  });

  it("takes a Summary only item's method tag and nothing from its body", () => {
    const call = corpusOf(rows).items.find((item) => item.id === itemId("b1", "int-manufacturer"))!;
    expect(call.grade).toBe("summary");
    const thread = graph.threads.find((entry) => entry.id === "b1")!;
    const stop = thread.stops.find((entry) => entry.kind === "method" && entry.method === "customer_research");
    expect(stop).toMatchObject({ itemIds: expect.arrayContaining([itemId("b1", "int-manufacturer")]) });
    const demo = DEMO_BOARDS.find((board) => board.key === "b1")!.items.find((item) => item.key === "int-manufacturer")!;
    const text = strings(graph).join("\n");
    for (const part of [demo.title, demo.summary, demo.decisions ?? "", demo.entities ?? "", demo.body!.slice(0, 60), demo.body!.slice(-60)].filter(Boolean)) {
      expect(text).not.toContain(part);
    }
  });

  it("has no node, label or id that is a person", () => {
    const all = strings(graph);
    const names = DEMO_PEOPLE.flatMap((person) => [person.key, person.name, ...person.name.split(/\s+/)]);
    for (const text of all) for (const name of names) expect(mentions(text, name), `"${text}" names ${name}`).toBe(false);
    // The board lead is a person and stays out, even though the corpus carries it.
    const lead = corpusOf(rows).boards.find((board) => board.id === "b5")!.lead!;
    expect(DEMO_PEOPLE.map((person) => person.name)).toContain(lead);
    expect(all.some((text) => text.includes(lead))).toBe(false);
    expect(Object.keys(graph.threads[0]!)).not.toContain("lead");
  });

  it("loses a board's thread, and any method only it used, when its sharing is turned off", () => {
    // Give b1 a method no other board uses, so the drop is visible.
    const tagged = withItem(rows, itemId("b1", "problem"), (item) => ({ ...item, meta: { ...(item.meta as object), method: ["other"] } }));
    const before = graphOf(tagged);
    expect(before.methods.find((node) => node.id === "other")!.threadIds).toEqual(["b1"]);
    const after = graphOf({ ...tagged, boards: tagged.boards.filter((board) => board.id !== "b1") });
    expect(after.threads.map((thread) => thread.id)).not.toContain("b1");
    expect(after.methods.map((node) => node.id)).not.toContain("other");
    for (const node of before.methods.filter((entry) => entry.id !== "other")) {
      const kept = after.methods.find((entry) => entry.id === node.id);
      const rest = node.threadIds.filter((id) => id !== "b1");
      if (!rest.length) expect(kept).toBeUndefined();
      else expect(kept!.threadIds).toEqual(rest);
    }
    const situation = before.threads.find((thread) => thread.id === "b1")!.situation;
    expect(after.situations.find((node) => node.id === situation)?.threadIds ?? []).not.toContain("b1");
    expect(strings(after).some((text) => text === "b1" || idsOf("b1").has(text))).toBe(false);
  });

  it("gives the same graph for the same corpus, in any order", () => {
    const corpus = corpusOf(rows);
    expect(assembleFirmGraph(corpus)).toEqual(assembleFirmGraph(corpus));
    const shuffled: FirmCorpus = { ...corpus, boards: [...corpus.boards].reverse(), items: [...corpus.items].reverse() };
    expect(assembleFirmGraph(shuffled)).toEqual(assembleFirmGraph(corpus));
  });

  it("reads other when no item names a situation, and leaves out lesson and deck stops a board does not have", () => {
    const corpus = corpusOf(rows);
    const bare: FirmCorpus = {
      ...corpus,
      boards: corpus.boards.filter((board) => board.id === "b4").map((board) => ({ ...board, outcome: null })),
      items: corpus.items.filter((item) => item.boardId === "b4" && item.id !== itemId("b4", "sow") && !item.shown.length && item.stage !== "shown_to_client"),
    };
    const [thread] = assembleFirmGraph(bare).threads;
    expect(thread!.stops[0]).toMatchObject({ kind: "situation", situation: "other", itemId: null });
    expect(thread!.stops.some((stop) => stop.kind === "lesson" || stop.kind === "client_deck")).toBe(false);
    expect(assembleFirmGraph({ orgId: "org", boards: [], items: [] })).toEqual({ situations: [], methods: [], threads: [] });
  });
});
