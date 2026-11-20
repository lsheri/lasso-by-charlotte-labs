/**
 * 20 Nov 2026, D-85 (Liam): the Firm brain page as one canvas. The firm map is the page, full bleed, pannable and
 * zoomable. A question floats on it; the answer lands beside the threads it came from, which pull into a tight column
 * next to it, and it stays where it landed. Everyone in the firm sees the map. Fees reach admins and leads only, and
 * for everyone else they are taken out on the server, so no fee or money figure is ever sent to their browser.
 *
 * Everything here is pure: the server shaping, the 2D layout, culling, placement, the pull, and the words.
 */

import type { FirmCorpus } from "./firm-corpus-shared";
import type { FirmGraph } from "./firm-graph-shared";
import { forMap, mapTotals, threadName, type MapTotals } from "./firm-map-shared";

/* ---------------------------------------------------------------------------------------------------------------
 * What the server sends
 * ------------------------------------------------------------------------------------------------------------- */

/** The firm graph for the canvas. `fees` is null for anyone who does not see fees, never an empty promise of one. */
export type FirmCanvasData = FirmGraph & { fees: Record<string, string> | null };

/** Who sees fees on the canvas: admins and leads, as everywhere else in the firm brain. */
export function canvasSeesFees(role: string | null | undefined): boolean {
  return role === "admin" || role === "lead";
}

// Money as people write it in titles and client names (QA M2, 21 Nov): a symbol, with or without a country prefix
// ("$45k", "US$ 45,000", "A$80k", "¥5,000,000", "₹40 lakh"); a code before or after ("USD 45 000", "45,000 EUR");
// a symbol after ("45 000 €", "45,000€", "45.000 €"); dot, comma or space thousands ("€1.200.000"); scale words
// ("1.2 million", "3.5MM", "$1.5B"); a bare "120k". A bare "5m" is left alone: it is as often a count ("Top 5m
// customers") as a sum.
const SYMBOL = "(?:(?:\\b(?:US|AU|A|CA|C|NZ|HK|SG|S|NT|R|MX))?[$£€¥₹₩₽₪₦₺฿])";
const CODES = "USD|GBP|EUR|AUD|CAD|NZD|CHF|SGD|JPY|INR|CNY|RMB|HKD|SEK|NOK|DKK|ZAR|BRL|MXN|AED|SAR";
const WORDS = "dollars?|pounds?|euros?|yen|rupees?|francs?";
const NUMBER =
  "(?:(?<![\\d.,])\\d{1,3}(?:[,.\\u00A0\\u202F ]\\d{3})+(?:[.,]\\d+)?|(?<![\\d.,])\\d+(?:[.,]\\d+)?)";
const SCALE = "(?:\\s?(?:k|m|mm|mn|bn|b|million|billion|thousand|lakhs?|crores?)\\b)";
const SCALE_WORD = "(?:million|billion|thousand|lakhs?|crores?|mm|mn|bn)\\b";
const PER = "(?:\\s?(?:/|per|a)\\s?(?:month|mo|week|wk|year|yr|day|hour|hr)\\b)?";
const MONEY = new RegExp(
  [
    `${SYMBOL}\\s?${NUMBER}${SCALE}?${PER}`,
    `\\b(?:${CODES})\\s?${NUMBER}${SCALE}?${PER}`,
    `${NUMBER}${SCALE}?\\s?(?:${SYMBOL}|\\b(?:${CODES}|${WORDS})\\b)${PER}`,
    `${NUMBER}\\s?${SCALE_WORD}${PER}`,
    `${NUMBER}\\s?k\\b${PER}`,
  ].join("|"),
  "gi",
);

/** The text with every money figure taken out. Used on titles and client names sent to someone who does not see fees. */
export function withoutMoney(text: string): string {
  return text
    .replace(MONEY, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:·-]+|[\s,;:·-]+$/g, "")
    .trim();
}

/** True when the text still holds a money figure. The test that guards the server output uses it. */
export function hasMoney(text: string): boolean {
  MONEY.lastIndex = 0;
  const found = MONEY.test(text);
  MONEY.lastIndex = 0;
  return found;
}

/**
 * The canvas data for one viewer, built on the server. Lesson text never leaves (as on the map). For someone who does
 * not see fees there is no `fees` record at all and every title and client name has its money figures removed, so
 * nothing in the response can carry a fee. For admins and leads, each engagement's fee comes from its SOW facts, written
 * by code from data, never by a model.
 */
export function canvasDataFor(
  graph: FirmGraph,
  corpus: FirmCorpus,
  seesFees: boolean,
): FirmCanvasData {
  const base = forMap(graph);
  if (!seesFees) {
    return {
      situations: base.situations,
      methods: base.methods,
      threads: base.threads.map((thread) => ({
        ...thread,
        title: withoutMoney(thread.title),
        client: thread.client === null ? null : withoutMoney(thread.client),
      })),
      fees: null,
    };
  }
  const fees: Record<string, string> = {};
  for (const thread of base.threads) {
    const facts = corpus.items.find(
      (item) => item.boardId === thread.id && item.sowFacts,
    )?.sowFacts;
    const fee = facts?.["fee_text"];
    if (typeof fee === "string" && fee.trim()) fees[thread.id] = fee.trim();
  }
  return { ...base, fees };
}

/**
 * How long Home keeps the firm map before reading it again (QA M3). Home is the landing page, so a fresh read on every
 * visit and every return to the tab would read the whole firm each time. Firm brain itself reads fresh when opened.
 */
export const FIRM_MAP_HOME_CACHE = { staleTime: 60_000, refetchOnWindowFocus: false } as const;

/* ---------------------------------------------------------------------------------------------------------------
 * The layout: situations on the left, engagements in the middle, methods on the right
 * ------------------------------------------------------------------------------------------------------------- */

export const CANVAS_SIZES = {
  nodeW: 220,
  nodeH: 36,
  rowH: 50,
  colGap: 250,
  bandPad: 18,
  bandGap: 16,
  situationX: 0,
  situationW: 280,
  threadX: 400,
  methodGap: 90,
  methodW: 180,
  methodMinGap: 46,
  /** Room between the methods column and an answer, for the engagements pulled beside it. */
  pullGap: 70,
  answerW: 400,
} as const;

export type CanvasNodeKind = "situation" | "thread" | "method";

export type CanvasNode = {
  /** situation:<id>, thread:<board id> or method:<id>. */
  id: string;
  kind: CanvasNodeKind;
  label: string;
  /** Left edge. */
  x: number;
  /** Vertical centre. */
  y: number;
  w: number;
  h: number;
  /** The board id, on thread nodes. */
  threadId?: string;
};

export type CanvasEdge = { id: string; from: string; to: string };

export type CanvasRect = { x: number; y: number; w: number; h: number };

export type CanvasLayout = {
  situations: CanvasNode[];
  threads: CanvasNode[];
  methods: CanvasNode[];
  edges: CanvasEdge[];
  byId: Map<string, CanvasNode>;
  bounds: CanvasRect;
  totals: MapTotals;
  /** Where an answer's left edge goes: past the methods column and the pull column. */
  answerX: number;
};

export const canvasThreadId = (boardId: string) => `thread:${boardId}`;

/** Columns per band: two for a small firm, up to five when there are hundreds of engagements. */
export function columnsFor(threads: number, situations: number): number {
  if (situations <= 0) return 2;
  return Math.max(2, Math.min(5, Math.ceil(Math.sqrt(threads / situations))));
}

/**
 * Where everything sits. Situations keep the vocabulary order the graph gives them, engagements sit in their
 * situation's band oldest first, methods spread down the right. The same graph always gives the same layout.
 */
export function layoutCanvas(graph: FirmGraph): CanvasLayout {
  const S = CANVAS_SIZES;
  const cols = columnsFor(graph.threads.length, graph.situations.length);
  const situations: CanvasNode[] = [];
  const threads: CanvasNode[] = [];
  const byThread = new Map(graph.threads.map((thread) => [thread.id, thread]));
  let y = 0;
  for (const situation of graph.situations) {
    const members = situation.threadIds
      .map((id) => byThread.get(id))
      .filter((thread) => thread !== undefined);
    const rows = Math.max(1, Math.ceil(members.length / cols));
    const bandH = rows * S.rowH + S.bandPad * 2;
    situations.push({
      id: `situation:${situation.id}`,
      kind: "situation",
      label: situation.label,
      x: S.situationX,
      y: y + bandH / 2,
      w: S.situationW,
      h: S.nodeH,
    });
    members.forEach((thread, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      threads.push({
        id: canvasThreadId(thread.id),
        kind: "thread",
        label: threadName(thread),
        x: S.threadX + col * S.colGap + (row % 2 ? 24 : 0),
        y: y + S.bandPad + S.rowH / 2 + row * S.rowH,
        w: S.nodeW,
        h: S.nodeH,
        threadId: thread.id,
      });
    });
    y += bandH + S.bandGap;
  }
  const height = Math.max(y - S.bandGap, S.rowH);
  const methodX = S.threadX + cols * S.colGap + 24 + S.methodGap;
  const step =
    graph.methods.length > 1
      ? Math.max(S.methodMinGap, (height - S.rowH) / (graph.methods.length - 1))
      : 0;
  const methods: CanvasNode[] = graph.methods.map((method, index) => ({
    id: `method:${method.id}`,
    kind: "method",
    label: method.label,
    x: methodX,
    y: S.rowH / 2 + index * step,
    w: S.methodW,
    h: S.nodeH,
  }));

  const edges: CanvasEdge[] = [];
  for (const thread of graph.threads) {
    const node = canvasThreadId(thread.id);
    edges.push({
      id: `${thread.situation}>${thread.id}`,
      from: `situation:${thread.situation}`,
      to: node,
    });
    for (const stop of thread.stops) {
      if (stop.kind === "method")
        edges.push({ id: `${thread.id}>${stop.method}`, from: node, to: `method:${stop.method}` });
    }
  }
  const byId = new Map<string, CanvasNode>(
    [...situations, ...threads, ...methods].map((node) => [node.id, node]),
  );
  // An edge whose ends are not both drawn (a situation with no node, say) is dropped rather than drawn to nowhere.
  const drawn = edges.filter((edge) => byId.has(edge.from) && byId.has(edge.to));
  const methodsBottom = methods.length ? methods[methods.length - 1]!.y + S.nodeH : 0;
  const bottom = Math.max(height, methodsBottom);
  return {
    situations,
    threads,
    methods,
    edges: drawn,
    byId,
    bounds: { x: S.situationX, y: 0, w: methodX + S.methodW - S.situationX, h: bottom },
    totals: mapTotals(graph),
    answerX: methodX + S.methodW + S.pullGap + S.nodeW + S.pullGap,
  };
}

/* ---------------------------------------------------------------------------------------------------------------
 * Culling: only what is on screen is drawn, so a firm with hundreds of engagements stays smooth
 * ------------------------------------------------------------------------------------------------------------- */

/** The most threads drawn at once. Past it, the ones touching an engagement in view win. */
export const MAX_EDGES_DRAWN = 900;

function overlaps(a: CanvasRect, b: CanvasRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export type Placed = { x: number; y: number };

/** A node's box at its current place (a pulled engagement moves). */
export function boxOf(node: CanvasNode, at?: Placed): CanvasRect {
  const x = at?.x ?? node.x;
  const y = at?.y ?? node.y;
  return { x, y: y - node.h / 2, w: node.w, h: node.h };
}

/**
 * What to draw for a view rectangle in world units. Nodes whose box meets the view (plus a margin), and edges whose
 * span meets it. Ids in `keep` are always drawn (the engagements behind the answer in focus).
 */
export function visibleIn(
  layout: CanvasLayout,
  view: CanvasRect,
  options: { margin?: number; keep?: ReadonlySet<string>; at?: ReadonlyMap<string, Placed> } = {},
): { nodes: Set<string>; edges: CanvasEdge[] } {
  const margin = options.margin ?? 160;
  const area = {
    x: view.x - margin,
    y: view.y - margin,
    w: view.w + margin * 2,
    h: view.h + margin * 2,
  };
  const nodes = new Set<string>();
  for (const node of layout.byId.values()) {
    if (options.keep?.has(node.id) || overlaps(boxOf(node, options.at?.get(node.id)), area))
      nodes.add(node.id);
  }
  const span = (edge: CanvasEdge): CanvasRect | null => {
    const a = layout.byId.get(edge.from);
    const b = layout.byId.get(edge.to);
    if (!a || !b) return null;
    const pa = options.at?.get(a.id) ?? a;
    const pb = options.at?.get(b.id) ?? b;
    const x0 = Math.min(pa.x, pb.x);
    const x1 = Math.max(pa.x + a.w, pb.x + b.w);
    const y0 = Math.min(pa.y, pb.y);
    const y1 = Math.max(pa.y, pb.y);
    return { x: x0, y: y0, w: x1 - x0, h: Math.max(1, y1 - y0) };
  };
  let edges = layout.edges.filter((edge) => {
    if (options.keep?.has(edge.from) || options.keep?.has(edge.to)) return true;
    const box = span(edge);
    return box !== null && overlaps(box, area);
  });
  if (edges.length > MAX_EDGES_DRAWN) {
    const touching = edges.filter((edge) => nodes.has(edge.from) && nodes.has(edge.to));
    const rest = edges.filter((edge) => !(nodes.has(edge.from) && nodes.has(edge.to)));
    edges = [...touching, ...rest].slice(0, MAX_EDGES_DRAWN);
  }
  return { nodes, edges };
}

/* ---------------------------------------------------------------------------------------------------------------
 * Answers: where one lands, and the engagements it pulls beside it
 * ------------------------------------------------------------------------------------------------------------- */

export type AnswerBox = { id: string; x: number; y: number; h: number };

/** The boards an answer quoted, in the order its lines first name them. */
export function answerBoards(claims: readonly { boardId: string }[]): string[] {
  return [...new Set(claims.map((claim) => claim.boardId))];
}

/**
 * Where an answer goes. Beside the engagements it quoted (their middle), or at `fallbackY` before it has any, to the
 * right of the map, then pushed down past any answer already there. Answers never move once placed by this.
 */
export function placeAnswer(
  layout: CanvasLayout,
  others: readonly AnswerBox[],
  height: number,
  boardIds: readonly string[],
  fallbackY: number,
): { x: number; y: number } {
  const ys = boardIds
    .map((id) => layout.byId.get(canvasThreadId(id))?.y)
    .filter((value): value is number => typeof value === "number");
  const centre = ys.length ? ys.reduce((sum, value) => sum + value, 0) / ys.length : fallbackY;
  let y = Math.max(layout.bounds.y, centre - height / 2);
  const x = layout.answerX;
  const sorted = [...others].sort((a, b) => a.y - b.y);
  for (let guard = 0; guard < sorted.length + 1; guard += 1) {
    const hit = sorted.find((other) => y < other.y + other.h + 32 && y + height + 32 > other.y);
    if (!hit) break;
    y = hit.y + hit.h + 32;
  }
  return { x, y };
}

/**
 * Where each pulled engagement sits: in one column just left of the answer, level with the first line that quotes it.
 * `lineCentres` are the centres of the answer's lines, measured from its top.
 */
export function pullTargets(
  answer: { x: number; y: number },
  claims: readonly { boardId: string }[],
  lineCentres: readonly number[],
): Map<string, Placed> {
  const S = CANVAS_SIZES;
  const out = new Map<string, Placed>();
  const used: number[] = [];
  claims.forEach((claim, index) => {
    const node = canvasThreadId(claim.boardId);
    if (out.has(node)) return;
    let y = answer.y + (lineCentres[index] ?? 60 + index * 56);
    // Two boards quoted on lines close together never sit on top of each other.
    for (const taken of used) if (Math.abs(taken - y) < S.nodeH + 8) y = taken + S.nodeH + 8;
    used.push(y);
    out.set(node, { x: answer.x - S.pullGap - S.nodeW, y });
  });
  return out;
}

/** A thread drawn between two points; `bend` 1 is the resting curve, 0 is pulled straight. */
export function threadPath(from: Placed, to: Placed, bend: number): string {
  const dx = (to.x - from.x) * 0.5 * bend;
  const f = (n: number) => n.toFixed(1);
  return `M${f(from.x)} ${f(from.y)}C${f(from.x + dx)} ${f(from.y)},${f(to.x - dx)} ${f(to.y)},${f(to.x)} ${f(to.y)}`;
}

/** The two ends of an edge at the nodes' current places: right side of the left node, left side of the right node. */
export function edgeEnds(
  layout: CanvasLayout,
  edge: CanvasEdge,
  at?: ReadonlyMap<string, Placed>,
): [Placed, Placed] | null {
  const a = layout.byId.get(edge.from);
  const b = layout.byId.get(edge.to);
  if (!a || !b) return null;
  const pa = at?.get(a.id) ?? a;
  const pb = at?.get(b.id) ?? b;
  // A pulled engagement can end up right of its method: then the thread runs from the method back to it.
  const leftFirst = pa.x <= pb.x;
  const [l, lp, r, rp] = leftFirst ? [a, pa, b, pb] : [b, pb, a, pa];
  return [
    { x: lp.x + l.w, y: lp.y },
    { x: rp.x, y: rp.y },
  ];
}

/* ---------------------------------------------------------------------------------------------------------------
 * Motion
 * ------------------------------------------------------------------------------------------------------------- */

/** Liam's one easing curve, cubic-bezier(.45,0,.2,1), as a function of progress 0..1. */
export function easeFlow(t: number): number {
  const p1x = 0.45,
    p1y = 0,
    p2x = 0.2,
    p2y = 1;
  const cx = 3 * p1x,
    bx = 3 * (p2x - p1x) - cx,
    ax = 1 - cx - bx;
  const cy = 3 * p1y,
    by = 3 * (p2y - p1y) - cy,
    ay = 1 - cy - by;
  const x = (u: number) => ((ax * u + bx) * u + cx) * u;
  const dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  const clamped = Math.max(0, Math.min(1, t));
  let u = clamped;
  for (let i = 0; i < 8; i += 1) {
    const err = x(u) - clamped;
    const slope = dx(u);
    if (Math.abs(err) < 1e-5 || Math.abs(slope) < 1e-6) break;
    u = Math.max(0, Math.min(1, u - err / slope));
  }
  return ((ay * u + by) * u + cy) * u;
}

/** A camera move's length: distance at 0.85 px per ms, between 450 and 1200 ms. */
export function moveDuration(distance: number): number {
  return Math.round(Math.max(450, Math.min(1200, Math.abs(distance) / 0.85)));
}

/* ---------------------------------------------------------------------------------------------------------------
 * The build reveal's captions
 * ------------------------------------------------------------------------------------------------------------- */

/** While the firm is being read: what is happening, stage by stage, never "Loading". */
export const PENDING_STAGES: readonly { at: number; text: string }[] = [
  { at: 0, text: "Reading your question" },
  { at: 1600, text: "Finding past work that matches" },
  { at: 3400, text: "Reading the closest engagements" },
  { at: 5400, text: "Checking each line against its source" },
];

export function pendingCaption(elapsedMs: number): string {
  let text = PENDING_STAGES[0]!.text;
  for (const stage of PENDING_STAGES) if (elapsedMs >= stage.at) text = stage.text;
  return text;
}

/** The percentage while waiting: climbs steadily toward 90 and never stalls or jumps back. */
export function pendingPercent(elapsedMs: number): number {
  return Math.floor(90 * (1 - Math.exp(-Math.max(0, elapsedMs) / 6000)));
}

/** Time between two revealed lines once the answer is in. */
export const LINE_REVEAL_MS = 700;

export const FIRM_CANVAS_COPY = {
  counts: {
    engagements: "engagements",
    situations: "situations",
    methods: "methods",
    lessons: "lessons",
  },
  ask: "Ask the firm",
  askLabel: "Question for the firm",
  send: "Ask",
  writing: "Writing the answer with its sources",
  done: (lines: number, engagements: number) =>
    `${lines} ${lines === 1 ? "line" : "lines"} from ${engagements} ${engagements === 1 ? "engagement" : "engagements"}`,
  failed: "That did not work. Try again.",
  tryAgain: "Try again",
  fees: "Fees",
  feesOn: "Hide fees",
  tools: "Prepare me",
  toolsTitle: "Prepare me and How we do this",
  list: "List",
  listTitle: "Every engagement on the map",
  listHint:
    "Every engagement shared with the firm, by the kind of problem it answered. Pick one to fly to it on the map.",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit to screen",
  mapLoadFailed: "The firm map could not be loaded. Try again in a moment.",
  retry: "Try again",
  empty: "Nothing is shared with the firm yet. Answers come only from boards shared with the firm.",
  drawing: "Drawing the firm map",
  drawn: (totals: MapTotals) =>
    `${totals.engagements} engagements, ${totals.situations} situations, ${totals.methods} methods`,
  canvasLabel: "The firm map. Drag to move, pinch or use the buttons to zoom.",
  source: "Open the source",
  backHome: "Home",
} as const;
