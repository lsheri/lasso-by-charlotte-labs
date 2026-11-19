// 18 Nov: Firm Brain Build Spec, steps 3 and 4. The firm map's pure model: the layout, the interactions, Replay's
// order and the answer trace, all over the demo firm's graph as the firm reader would serve it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { DEMO_BOARDS } from "@/lib/demo-firm";
import type { FirmAskResult } from "@/lib/firm-ask-shared";
import type { FirmCorpus } from "@/lib/firm-corpus-shared";
import { assembleFirmGraph } from "@/lib/firm-graph-shared";
import {
  answerTrace,
  canSeeFirmMap,
  deckNodeId,
  forMap,
  INITIAL_MAP_STATE,
  layoutFirmMap,
  listBySituation,
  litNodes,
  litThreads,
  mapReducer,
  methodNodeId,
  project,
  readingFor,
  replayDelays,
  situationNodeId,
  threadNodeId,
  type MapState,
} from "@/lib/firm-map-shared";

import {
  corpusOf,
  demoRows,
  graphOf,
  idsOf,
  itemId,
  mentions,
  PERSON_WORDS,
  UNSHARED,
} from "./helpers/demo-firm-rows";

const graph = forMap(graphOf(demoRows()));
const layout = layoutFirmMap(graph);
const threadIds = layout.threads.map((thread) => thread.id);

function answered(
  claims: { itemId: string; boardId: string }[],
  extra: Partial<FirmAskResult> = {},
): FirmAskResult {
  const corpus = corpusOf(demoRows());
  const sources: FirmAskResult["sources"] = {};
  for (const claim of claims) {
    const item = corpus.items.find((entry) => entry.id === claim.itemId);
    if (item)
      sources[claim.itemId] = {
        title: item.title,
        type: item.type,
        date: item.date,
        boardId: item.boardId,
        boardTitle: "x",
        shownOn: null,
      };
  }
  return {
    status: "answered",
    summary: "s",
    claims: claims.map((claim) => ({ text: "t", quote: "q", grade: "quoted", ...claim })),
    facts: [],
    nearest: null,
    read: { full: claims.map((claim) => claim.itemId), summary: [] },
    sources,
    coverage: "c",
    oneSource: claims.length === 1,
    ...extra,
  };
}

describe("the layout", () => {
  it("is pure: the same graph gives the same positions, in any order, with no randomness", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("the layout must not use Math.random");
    });
    try {
      expect(layoutFirmMap(graph)).toEqual(layout);
      const frozen = structuredClone(graph);
      const deepFreeze = (value: unknown): void => {
        if (value && typeof value === "object") {
          Object.freeze(value);
          Object.values(value).forEach(deepFreeze);
        }
      };
      deepFreeze(frozen);
      expect(layoutFirmMap(frozen)).toEqual(layout);
      // The same corpus served in another order gives the same graph, so the same map.
      const corpus = corpusOf(demoRows());
      const shuffled: FirmCorpus = {
        ...corpus,
        boards: [...corpus.boards].reverse(),
        items: [...corpus.items].reverse(),
      };
      expect(layoutFirmMap(forMap(assembleFirmGraph(shuffled)))).toEqual(layout);
    } finally {
      random.mockRestore();
    }
  });

  it("keeps every point where it was when another board is shared or unshared", () => {
    const without = layoutFirmMap(
      forMap(graphOf(demoRows(DEMO_BOARDS.filter((board) => board.key !== "b1")))),
    );
    for (const node of without.nodes) {
      const before = layout.nodes.find((entry) => entry.id === node.id);
      if (before) expect(node.position, node.id).toEqual(before.position);
    }
  });

  it("draws one thread per engagement through its situation, methods in order, lesson and deck", () => {
    expect(threadIds).toEqual(graph.threads.map((thread) => thread.id));
    for (const thread of layout.threads) {
      const source = graph.threads.find((entry) => entry.id === thread.id)!;
      const expected = source.stops.map((stop) =>
        stop.kind === "situation"
          ? situationNodeId(stop.situation)
          : stop.kind === "method"
            ? methodNodeId(stop.method)
            : stop.kind === "lesson"
              ? `lesson:${thread.id}`
              : deckNodeId(thread.id),
      );
      expect(thread.nodeIds).toEqual(expected);
      // p0, then a control point and an end per hop, ending on the last point.
      if (thread.nodeIds.length > 1) {
        expect(thread.path).toHaveLength(1 + 2 * (thread.nodeIds.length - 1));
        const last = layout.nodes.find((node) => node.id === thread.nodeIds.at(-1))!;
        expect(thread.path.at(-1)).toEqual(last.position);
      }
      for (const point of thread.path)
        for (const value of point) expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("projects to the same place every time", () => {
    const point = layout.nodes[0]!.position;
    expect(project(point, 0.55, 0.28)).toEqual(project(point, 0.55, 0.28));
    expect(project([0, 0, 0], 1, 1)).toEqual({ x: 0, y: -0, depth: 0, scale: 1 });
  });
});

describe("privacy on the map", () => {
  it("never draws or counts b13, b20, b23 or b28, which are not shared", () => {
    const withUnshared = layoutFirmMap(
      forMap(graphOf(demoRows(DEMO_BOARDS, { includeUnsharedItems: true }))),
    );
    const withoutUnshared = layoutFirmMap(
      forMap(graphOf(demoRows(DEMO_BOARDS.filter((board) => !UNSHARED.includes(board.key))))),
    );
    expect(withUnshared).toEqual(layout);
    expect(withoutUnshared.totals).toEqual(layout.totals);
    expect(layout.totals.engagements).toBe(
      DEMO_BOARDS.filter((board) => board.sharedWithFirm).length,
    );
    const text = JSON.stringify(layout);
    for (const key of UNSHARED) {
      const board = DEMO_BOARDS.find((entry) => entry.key === key)!;
      expect(threadIds).not.toContain(key);
      expect(text.includes(`"${key}"`) || text.includes(`:${key}"`), key).toBe(false);
      for (const id of idsOf(key)) expect(text).not.toContain(`"${id}"`);
      expect(text).not.toContain(board.title);
    }
  });

  it("has no point, label or reading row that is a person", () => {
    const words: string[] = [];
    for (const node of layout.nodes) words.push(node.id, node.label);
    for (const thread of layout.threads)
      words.push(thread.name, thread.title, thread.situationLabel, ...thread.methodLabels);
    for (const node of layout.nodes) {
      const reading = readingFor({ ...INITIAL_MAP_STATE, pinned: node.id }, layout);
      words.push(JSON.stringify(reading));
    }
    for (const text of words)
      for (const name of PERSON_WORDS)
        expect(mentions(text, name), `"${text.slice(0, 80)}" names ${name}`).toBe(false);
  });

  it("carries no lesson text to the browser", () => {
    const full = graphOf(demoRows());
    const lessons = full.threads.flatMap((thread) =>
      thread.stops.flatMap((stop) => (stop.kind === "lesson" ? [stop.text] : [])),
    );
    expect(lessons.length).toBeGreaterThan(0);
    const sent = JSON.stringify(forMap(full));
    for (const lesson of lessons) expect(sent).not.toContain(lesson);
    expect(forMap(full).threads.map((thread) => thread.id)).toEqual(
      full.threads.map((thread) => thread.id),
    );
  });

  it("shows to firm members, never to a guest or a coach, or outside a company", () => {
    const member = { role: "em", has_firm_view: true, org_type: "company", is_guest: false };
    expect(canSeeFirmMap(member)).toBe(true);
    expect(canSeeFirmMap({ ...member, is_guest: true })).toBe(false);
    expect(canSeeFirmMap({ ...member, role: "coach" })).toBe(false);
    expect(canSeeFirmMap({ ...member, has_firm_view: false, org_type: "personal" })).toBe(
      false,
    );
    expect(canSeeFirmMap(null)).toBe(false);
  });
});

describe("pulling threads", () => {
  it("pulls a point's threads on hover, keeps a tapped point pinned, and lets it go on a second tap", () => {
    const method = layout.nodes.find((node) => node.kind === "method")!;
    let state: MapState = mapReducer(INITIAL_MAP_STATE, { type: "hover", nodeId: method.id });
    expect([...litThreads(state, layout)!].sort()).toEqual([...method.threadIds].sort());
    expect(readingFor(state, layout)).toMatchObject({ kind: "node", node: { id: method.id } });
    // Every point on a pulled thread stays bright; the rest fade.
    const bright = litNodes(litThreads(state, layout), layout)!;
    expect(bright.has(method.id)).toBe(true);
    for (const node of layout.nodes)
      expect(bright.has(node.id)).toBe(node.threadIds.some((id) => method.threadIds.includes(id)));

    state = mapReducer(state, { type: "pick", nodeId: method.id });
    state = mapReducer(state, { type: "hover", nodeId: null });
    expect(litThreads(state, layout)).toEqual(new Set(method.threadIds));
    state = mapReducer(state, { type: "pick", nodeId: method.id });
    expect(litThreads(state, layout)).toBeNull();
    expect(readingFor(state, layout)).toEqual({ kind: "overview", totals: layout.totals });
  });

  it("opens one engagement from the list, and a held row pulls its thread without changing the panel", () => {
    const thread = layout.threads[3]!;
    let state = mapReducer(INITIAL_MAP_STATE, { type: "pick", nodeId: threadNodeId(thread.id) });
    expect(litThreads(state, layout)).toEqual(new Set([thread.id]));
    expect(readingFor(state, layout)).toEqual({ kind: "thread", thread });
    const situation = layout.nodes.find((node) => node.kind === "situation")!;
    state = mapReducer(state, { type: "pick", nodeId: situation.id });
    state = mapReducer(state, { type: "focus", threadId: situation.threadIds[0]! });
    expect(litThreads(state, layout)).toEqual(new Set([situation.threadIds[0]]));
    expect(readingFor(state, layout)).toMatchObject({ kind: "node", node: { id: situation.id } });
  });

  it("sews oldest first on Replay, within a few seconds however many engagements there are", () => {
    const delays = replayDelays(layout);
    const order = [...layout.threads]
      .sort((a, b) => a.startedOn.localeCompare(b.startedOn) || a.id.localeCompare(b.id))
      .map((thread) => thread.id);
    expect([...delays.keys()]).toEqual(order);
    const values = [...delays.values()];
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(values[0]).toBe(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(4000);
  });

  it("lists every engagement once, under its situation", () => {
    const listed = listBySituation(layout).flatMap((group) =>
      group.threads.map((thread) => thread.id),
    );
    expect([...listed].sort()).toEqual([...threadIds].sort());
  });
});

describe("the answer trace", () => {
  const quoted = [
    { itemId: itemId("b5", "final"), boardId: "b5" },
    { itemId: itemId("b5", "proposal"), boardId: "b5" },
    { itemId: itemId("b7", "int-cfo"), boardId: "b7" },
  ];

  it("pulls exactly the engagements of the quoted items, no more and no fewer", () => {
    const result = answered(quoted);
    const trace = answerTrace(result, threadIds);
    expect(trace).toEqual(["b5", "b7"]);
    // Items it read but did not quote pull nothing.
    const readMore = {
      ...result,
      read: {
        full: [...result.read.full, itemId("b1", "problem")],
        summary: [itemId("b3", "codesign-notes")],
      },
    };
    expect(answerTrace(readMore, threadIds)).toEqual(["b5", "b7"]);
    // The board comes from the quoted item's own source, not from what the claim says.
    const mislabelled = answered([{ itemId: itemId("b7", "int-cfo"), boardId: "b1" }]);
    expect(answerTrace(mislabelled, threadIds)).toEqual(["b7"]);

    const state = mapReducer(INITIAL_MAP_STATE, { type: "trace", threadIds: trace });
    expect(litThreads(state, layout)).toEqual(new Set(["b5", "b7"]));
    expect(readingFor(state, layout)).toMatchObject({
      kind: "trace",
      threads: [{ id: "b5" }, { id: "b7" }],
    });
  });

  it("pulls a close-out lesson's engagement when the answer quotes it", () => {
    const result = answered([]);
    result.claims = [
      { text: "t", itemId: "outcome-b9", boardId: "b9", quote: "q", grade: "quoted" },
    ];
    result.sources["outcome-b9"] = {
      title: "Close-out lesson",
      type: "outcome",
      date: null,
      boardId: "b9",
      boardTitle: "x",
      shownOn: null,
    };
    expect(answerTrace(result, threadIds)).toEqual(["b9"]);
  });

  it("pulls nothing for a not found answer or a refused people question, whatever they carry", () => {
    expect(answerTrace(answered(quoted, { status: "not_found" }), threadIds)).toEqual([]);
    expect(answerTrace(answered(quoted, { status: "about_people" }), threadIds)).toEqual([]);
    expect(answerTrace(answered([]), threadIds)).toEqual([]);
    expect(answerTrace(null, threadIds)).toEqual([]);
    const state = mapReducer(INITIAL_MAP_STATE, { type: "trace", threadIds: [] });
    expect(litThreads(state, layout)).toBeNull();
  });

  it("never pulls a board that is not on the map", () => {
    expect(answerTrace(answered([{ itemId: "not-on-map", boardId: "b13" }]), threadIds)).toEqual(
      [],
    );
  });
});

describe("where the map may appear", () => {
  const root = path.resolve(__dirname, "../..");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (name === "__tests__" || name === "node_modules") return [];
      return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
    });
  const sources = files(root).map((file) => ({
    file: path.relative(root, file),
    text: readFileSync(file, "utf8"),
  }));

  it("is rendered only by the signed-in firm view, never on shared, demo, tour or rollup surfaces", () => {
    const users = sources
      .filter(({ text }) =>
        /from\s+["']@\/components\/firm-brain\/FirmBrainMap["']|from\s+["']\.\/FirmBrainMap["']/.test(
          text,
        ),
      )
      .map(({ file }) => file);
    expect(users).toEqual(["pages/FirmDashboardPage.tsx"]);
  });

  it("keeps three.js out of the main bundle: only the 3D map imports it, and only by dynamic import", () => {
    const staticThree = sources
      .filter(({ text }) => /from\s+["']three(?:\/[^"']*)?["']/.test(text))
      .map(({ file }) => file);
    expect(staticThree).toEqual(["components/firm-brain/FirmMap3D.tsx"]);
    const importers = sources
      .filter(({ text }) => /FirmMap3D/.test(text) && /import\s|from\s/.test(text))
      .map(({ file, text }) => ({ file, text }));
    for (const { file, text } of importers) {
      if (file.endsWith("FirmMap3D.tsx")) continue;
      expect(text, file).not.toMatch(/from\s+["'][^"']*FirmMap3D["']/);
    }
    expect(
      sources.find(({ file }) => file === "components/firm-brain/FirmBrainMap.tsx")!.text,
    ).toMatch(/import\(\s*["']\.\/FirmMap3D["']\s*\)/);
  });
});
