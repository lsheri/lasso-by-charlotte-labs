// 20 Nov, D-85: the pure rules behind the Firm brain canvas: the server shaping, the layout, culling, where answers
// land, the pull, the motion curve and the build reveal's words.
import { describe, expect, it } from "vitest";

import {
  answerBoards,
  canvasDataFor,
  canvasSeesFees,
  canvasThreadId,
  CANVAS_SIZES,
  columnsFor,
  easeFlow,
  edgeEnds,
  FIRM_CANVAS_COPY,
  FIRM_MAP_HOME_CACHE,
  hasMoney,
  layoutCanvas,
  MAX_EDGES_DRAWN,
  moveDuration,
  pendingCaption,
  pendingPercent,
  PENDING_STAGES,
  placeAnswer,
  pullTargets,
  threadPath,
  visibleIn,
  withoutMoney,
} from "@/lib/firm-canvas-shared";
import type { FirmGraph } from "@/lib/firm-graph-shared";
import { corpusOf, demoRows, graphOf, UNSHARED } from "@/lib/__tests__/helpers/demo-firm-rows";

describe("money figures", () => {
  it.each([
    ["$45k/month", ""],
    ["Fixed fee of £1.2m plus expenses", "Fixed fee of plus expenses"],
    ["EUR 90,000 for the sprint", "for the sprint"],
    ["120k retainer", "retainer"],
    ["Budget: 90,000 dollars", "Budget"],
    ["€380k", ""],
    ["CAD 2.5 million, two sites", "two sites"],
    // QA M2, 21 Nov: the formats the first pattern missed.
    ["45 000 € audit", "audit"],
    ["45,000€ audit", "audit"],
    ["45.000 € audit", "audit"],
    ["Fee 1.2 million", "Fee"],
    ["¥5,000,000 study", "study"],
    ["₹40 lakh", ""],
    ["3.5MM budget", "budget"],
    ["€1.200.000 programme", "programme"],
    ["USD 45 000", ""],
    ["$1.5B deal", "deal"],
    ["US$ 45,000", ""],
    ["A$80k", ""],
    ["2019 450 000 €", "2019"],
    ["Acme (GBP 1.2m)", "Acme"],
  ])("takes the money out of %s", (input, output) => {
    // Checked against the written-out answer, not against the pattern itself.
    expect(withoutMoney(input)).toBe(output);
  });

  it.each([
    "St. Brigid Health",
    "Fund II LP materials",
    "Q4 2026 readout",
    "5 methods",
    "B2B pricing",
    "Diabetes prevention service line",
    "Top 5m customers",
    "Top 3 000 users",
    "Phase 2 of 3",
    "Series A raise",
    // QA M1 (PR 281): a scale word or k with no currency or fee word is a count.
    "Pilot 120k",
    "2 million users",
    "1.2 million patients",
    "10k users",
    "5k employees",
    "4k video",
    "50 thousand visits",
    "500 lakh people",
    "1.2bn users",
    "2 bn people",
  ])("leaves %s alone", (text) => {
    expect(withoutMoney(text)).toBe(text);
    expect(hasMoney(text)).toBe(false);
  });

  it("sees fees only for admins and leads", () => {
    expect(canvasSeesFees("admin")).toBe(true);
    expect(canvasSeesFees("lead")).toBe(true);
    for (const role of ["em", "coach", null, undefined, ""])
      expect(canvasSeesFees(role)).toBe(false);
  });
});

describe("canvasDataFor", () => {
  const corpus = corpusOf(demoRows());
  const graph = graphOf(demoRows());

  it("gives no fee record at all to someone who does not see fees", () => {
    const data = canvasDataFor(graph, corpus, false);
    expect(data.fees).toBeNull();
    expect(data.threads).toHaveLength(graph.threads.length);
  });

  it("never carries an unshared board, for anyone", () => {
    for (const fees of [true, false]) {
      const data = canvasDataFor(graph, corpus, fees);
      for (const id of UNSHARED)
        expect(data.threads.some((thread) => thread.id === id)).toBe(false);
      for (const id of UNSHARED) expect(Object.keys(data.fees ?? {})).not.toContain(id);
    }
  });

  it("gives admins and leads each engagement's fee text as the SOW states it", () => {
    const data = canvasDataFor(graph, corpus, true);
    const st = corpus.items.find((item) => item.boardId === "b5" && item.sowFacts)!;
    expect(data.fees!["b5"]).toBe(st.sowFacts!["fee_text"]);
  });
});

describe("layoutCanvas", () => {
  const graph = graphOf(demoRows());
  const layout = layoutCanvas(graph);

  it("draws every engagement, situation and method once, and the same graph lays out the same way", () => {
    expect(layout.threads).toHaveLength(graph.threads.length);
    expect(layout.situations).toHaveLength(graph.situations.length);
    expect(layout.methods).toHaveLength(graph.methods.length);
    expect(JSON.stringify(layoutCanvas(graph).threads)).toBe(JSON.stringify(layout.threads));
    expect(layout.totals.engagements).toBe(graph.threads.length);
  });

  it("puts situations left, engagements in the middle and methods right, with answers past them", () => {
    const right = (x: number, w: number) => x + w;
    const sitRight = Math.max(...layout.situations.map((n) => right(n.x, n.w)));
    const threadLeft = Math.min(...layout.threads.map((n) => n.x));
    const threadRight = Math.max(...layout.threads.map((n) => right(n.x, n.w)));
    const methodLeft = Math.min(...layout.methods.map((n) => n.x));
    expect(sitRight).toBeLessThan(threadLeft);
    expect(threadRight).toBeLessThan(methodLeft);
    expect(layout.answerX).toBeGreaterThan(methodLeft + CANVAS_SIZES.methodW + CANVAS_SIZES.nodeW);
  });

  it("keeps engagements in their situation's band, never on top of one another", () => {
    const boxes = layout.threads.map((n) => ({ x: n.x, y: n.y - n.h / 2, w: n.w, h: n.h }));
    for (let i = 0; i < boxes.length; i += 1)
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!,
          b = boxes[j]!;
        const hit = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        expect(hit, `${layout.threads[i]!.label} and ${layout.threads[j]!.label}`).toBe(false);
      }
  });

  it("joins each engagement to its situation and to every method it used", () => {
    const thread = graph.threads[0]!;
    const methods = thread.stops.filter((stop) => stop.kind === "method").length;
    const touching = layout.edges.filter(
      (edge) => edge.to === canvasThreadId(thread.id) || edge.from === canvasThreadId(thread.id),
    );
    expect(touching).toHaveLength(1 + methods);
  });

  it("copes with an empty firm", () => {
    const empty = layoutCanvas({ situations: [], methods: [], threads: [] });
    expect(empty.threads).toEqual([]);
    expect(empty.edges).toEqual([]);
    expect(empty.bounds.h).toBeGreaterThan(0);
  });

  it("widens bands for a large firm", () => {
    expect(columnsFor(26, 12)).toBe(2);
    expect(columnsFor(600, 13)).toBe(5);
    expect(columnsFor(5, 0)).toBe(2);
  });
});

/** A firm with hundreds of engagements, to prove culling keeps the drawing small. */
function bigGraph(count: number): FirmGraph {
  const base = graphOf(demoRows());
  const threads = Array.from({ length: count }, (_, index) => {
    const source = base.threads[index % base.threads.length]!;
    return { ...source, id: `big-${index}`, title: `Engagement ${index}` };
  });
  return {
    situations: base.situations.map((s) => ({
      ...s,
      threadIds: threads.filter((t) => t.situation === s.id).map((t) => t.id),
    })),
    methods: base.methods.map((m) => ({
      ...m,
      threadIds: threads
        .filter((t) => t.stops.some((stop) => stop.kind === "method" && stop.method === m.id))
        .map((t) => t.id),
    })),
    threads,
  };
}

describe("visibleIn", () => {
  it("draws only what is near the view in a firm of 600 engagements", () => {
    const layout = layoutCanvas(bigGraph(600));
    const view = { x: 0, y: 0, w: 1400, h: 900 };
    const seen = visibleIn(layout, view);
    expect(layout.threads.length).toBe(600);
    expect([...seen.nodes].filter((id) => id.startsWith("thread:")).length).toBeLessThan(120);
    expect(seen.edges.length).toBeLessThanOrEqual(MAX_EDGES_DRAWN);
    expect(seen.edges.length).toBeGreaterThan(0);
  });

  it("always draws the engagements kept in focus, even off screen", () => {
    const layout = layoutCanvas(bigGraph(600));
    const far = layout.threads[layout.threads.length - 1]!;
    const seen = visibleIn(layout, { x: 0, y: 0, w: 800, h: 600 }, { keep: new Set([far.id]) });
    expect(seen.nodes.has(far.id)).toBe(true);
    expect(seen.edges.some((edge) => edge.to === far.id || edge.from === far.id)).toBe(true);
  });

  it("follows an engagement to where it has been pulled", () => {
    const layout = layoutCanvas(graphOf(demoRows()));
    const node = layout.threads[0]!;
    const view = { x: 5000, y: 5000, w: 400, h: 300 };
    expect(visibleIn(layout, view).nodes.has(node.id)).toBe(false);
    expect(
      visibleIn(layout, view, { at: new Map([[node.id, { x: 5100, y: 5100 }]]) }).nodes.has(
        node.id,
      ),
    ).toBe(true);
  });
});

describe("answers", () => {
  const layout = layoutCanvas(graphOf(demoRows()));
  const claims = [{ boardId: "b5" }, { boardId: "b6" }, { boardId: "b5" }];

  it("lists the boards an answer quoted once each, in the order its lines name them", () => {
    expect(answerBoards(claims)).toEqual(["b5", "b6"]);
    expect(answerBoards([])).toEqual([]);
  });

  it("lands beside the engagements it quoted, right of the map", () => {
    const spot = placeAnswer(layout, [], 300, ["b5", "b6"], 0);
    const ys = ["b5", "b6"].map((id) => layout.byId.get(canvasThreadId(id))!.y);
    expect(spot.x).toBe(layout.answerX);
    expect(spot.y).toBeCloseTo(Math.max(layout.bounds.y, (ys[0]! + ys[1]!) / 2 - 150), 0);
    const low = layout.threads[layout.threads.length - 1]!;
    const below = placeAnswer(layout, [], 100, [low.threadId!], 0);
    expect(below.y + 50).toBeCloseTo(low.y, 0);
  });

  it("never lands on top of an answer already there", () => {
    const first = placeAnswer(layout, [], 300, ["b5"], 0);
    const second = placeAnswer(layout, [{ id: "a", ...first, h: 300 }], 300, ["b5"], 0);
    expect(second.y).toBeGreaterThanOrEqual(first.y + 300);
  });

  it("uses the view's middle before anything is quoted, and stays inside the map's top", () => {
    expect(placeAnswer(layout, [], 200, [], 900).y).toBe(800);
    expect(placeAnswer(layout, [], 200, [], -500).y).toBe(layout.bounds.y);
  });

  it("pulls each quoted engagement into one column left of the answer, level with its first line", () => {
    const targets = pullTargets({ x: 2000, y: 100 }, claims, [40, 120, 200]);
    expect([...targets.keys()]).toEqual([canvasThreadId("b5"), canvasThreadId("b6")]);
    expect(targets.get(canvasThreadId("b5"))).toEqual({
      x: 2000 - CANVAS_SIZES.pullGap - CANVAS_SIZES.nodeW,
      y: 140,
    });
    expect(targets.get(canvasThreadId("b6"))!.y).toBe(220);
  });

  it("never stacks two pulled engagements when their lines sit close together", () => {
    const targets = pullTargets({ x: 0, y: 0 }, [{ boardId: "a" }, { boardId: "b" }], [50, 55]);
    const [a, b] = [...targets.values()];
    expect(Math.abs(a!.y - b!.y)).toBeGreaterThanOrEqual(CANVAS_SIZES.nodeH);
  });
});

describe("threads", () => {
  it("draws a resting curve and a straight pulled line", () => {
    expect(threadPath({ x: 0, y: 0 }, { x: 100, y: 50 }, 1)).toBe(
      "M0.0 0.0C50.0 0.0,50.0 50.0,100.0 50.0",
    );
    expect(threadPath({ x: 0, y: 0 }, { x: 100, y: 50 }, 0)).toBe(
      "M0.0 0.0C0.0 0.0,100.0 50.0,100.0 50.0",
    );
  });

  it("runs from the method back to an engagement pulled past it", () => {
    const layout = layoutCanvas(graphOf(demoRows()));
    const edge = layout.edges.find((e) => e.from.startsWith("thread:"))!;
    const method = layout.byId.get(edge.to)!;
    const [from, to] = edgeEnds(
      layout,
      edge,
      new Map([[edge.from, { x: method.x + 600, y: 10 }]]),
    )!;
    expect(from.x).toBe(method.x + method.w);
    expect(to.x).toBe(method.x + 600);
  });
});

describe("motion and words", () => {
  it("eases from 0 to 1 along Liam's curve", () => {
    expect(easeFlow(0)).toBe(0);
    expect(easeFlow(1)).toBeCloseTo(1, 5);
    expect(easeFlow(0.5)).toBeGreaterThan(0.4);
    let last = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      expect(easeFlow(t)).toBeGreaterThanOrEqual(last);
      last = easeFlow(t);
    }
  });

  it("moves the camera at 0.85 px per ms, between 450 and 1200 ms", () => {
    expect(moveDuration(0)).toBe(450);
    expect(moveDuration(680)).toBe(800);
    expect(moveDuration(5000)).toBe(1200);
  });

  it("names a concrete step at every stage of the wait, each on screen at least 1.5s, and never says Loading", () => {
    for (let i = 1; i < PENDING_STAGES.length; i += 1)
      expect(PENDING_STAGES[i]!.at - PENDING_STAGES[i - 1]!.at).toBeGreaterThanOrEqual(1500);
    expect(new Set(PENDING_STAGES.map((stage) => stage.text)).size).toBe(PENDING_STAGES.length);
    for (const stage of PENDING_STAGES)
      expect(stage.text).not.toMatch(/loading|thinking|working on it|almost/i);
    expect(pendingCaption(0)).toBe(PENDING_STAGES[0]!.text);
    expect(pendingCaption(60_000)).toBe(PENDING_STAGES[PENDING_STAGES.length - 1]!.text);
  });

  it("climbs the percentage steadily and never past 90 while waiting", () => {
    let last = -1;
    for (let ms = 0; ms < 60_000; ms += 500) {
      const value = pendingPercent(ms);
      expect(value).toBeGreaterThanOrEqual(last);
      expect(value).toBeLessThan(90);
      last = value;
    }
  });

  it("counts lines and engagements in plain words, with no em dash anywhere", () => {
    expect(FIRM_CANVAS_COPY.done(1, 1)).toBe("1 line from 1 engagement");
    expect(FIRM_CANVAS_COPY.done(3, 2)).toBe("3 lines from 2 engagements");
    const all = JSON.stringify(FIRM_CANVAS_COPY) + PENDING_STAGES.map((s) => s.text).join(" ");
    expect(all).not.toMatch(/—|–/);
    expect(all).not.toMatch(/audit|surveil|monitor|track/i);
  });
});

describe("Home's copy of the map (QA M3)", () => {
  it("is kept for a minute and not read again on every return to the tab", () => {
    expect(FIRM_MAP_HOME_CACHE).toEqual({ staleTime: 60_000, refetchOnWindowFocus: false });
  });

  it("is what Home uses, while Firm brain still reads fresh when opened", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const home = readFileSync(path.resolve(__dirname, "../../pages/HomePage.tsx"), "utf8");
    expect(home).toContain("...FIRM_MAP_HOME_CACHE");
    const canvas = readFileSync(
      path.resolve(__dirname, "../../components/firm-brain/FirmBrainCanvas.tsx"),
      "utf8",
    );
    expect(canvas).toMatch(/queryKey: \["firm-map", profile\.id \?\? null\],\s*staleTime: 0,/);
  });
});
