/**
 * The firm map (Firm Brain Build Spec: Threads and Walk-throughs, steps 3 and 4): where every point and stitch of the
 * firm brain sits, what a hover, tap or answer pulls, and the order Replay sews the threads in. Pure, so the same
 * graph always gives the same map, with no randomness except hashes of ids. Every renderer (the plain list, the 2D
 * map and the 3D map) draws from this one model, so they cannot disagree about what is on the map.
 *
 * It sees only the graph, which sees only what the firm reader serves: unshared boards, private and Out items never
 * reach it. People are never points: labels are the fixed vocabulary, the engagement's client or title, and fixed
 * words for lessons and decks.
 */

import { canAskTheFirm, type FirmAskResult } from "./firm-ask-shared";
import { METHODS, SITUATIONS, type Method, type Situation } from "./engagement-tags";
import type { FirmGraph, FirmThread } from "./firm-graph-shared";

export type Vec3 = readonly [number, number, number];

export type MapNodeKind = "situation" | "method" | "lesson" | "deck";

export type MapNode = {
  /** `situation:<tag>`, `method:<tag>`, `lesson:<board id>` or `deck:<board id>`. */
  id: string;
  kind: MapNodeKind;
  label: string;
  position: Vec3;
  /** Radius in map units: shared points grow with the threads that reach them. */
  size: number;
  threadIds: string[];
};

export type MapThread = {
  /** The board id. */
  id: string;
  /** The client's name, or the board title when it has none. */
  name: string;
  title: string;
  client: string | null;
  startedOn: string;
  situationLabel: string;
  /** Methods in the order the thread reached them. */
  methodLabels: string[];
  hasLesson: boolean;
  hasDeck: boolean;
  /** The points the thread runs through, in order: situation, methods, lesson, deck. */
  nodeIds: string[];
  /**
   * The stitch as quadratic hops: [p0, c1, p1, c2, p2, ...]. Each control point arcs the hop outward, like a stitch
   * rising over the cloth. Empty when the thread has only its situation.
   */
  path: Vec3[];
};

export type MapTotals = {
  engagements: number;
  situations: number;
  methods: number;
  lessons: number;
};

export type FirmMapLayout = { nodes: MapNode[]; threads: MapThread[]; totals: MapTotals };

export const FIRM_MAP_COPY = {
  title: "The firm brain",
  hint: "Every thread is one engagement shared with the firm. Where threads meet, the firm has done the same thing before.",
  replay: "Replay the threads",
  loading: "Drawing the firm brain",
  error: "The map could not be loaded. Ask the firm still works.",
  empty:
    "Nothing is shared with the firm yet. Share a board with the firm and its thread appears here.",
  listTitle: "Engagements by situation",
  listMethods: "Methods the firm has used",
  mapLabel: "Map of engagements shared with the firm",
  overviewEyebrow: "What the firm has done",
  overviewTitle: "Everything the firm has done, ready to pull on",
  overviewBody:
    "Ask how a kind of problem was handled before, or pick a point. The threads that touched it are pulled tight.",
  engagements: "engagements",
  situations: "situations",
  methods: "methods",
  lessons: "lessons",
  traceEyebrow: "Your answer",
  traceTitle: (count: number) =>
    `The answer quoted ${count} ${count === 1 ? "engagement" : "engagements"}`,
  traceBody: "Their threads are pulled on the map. Every other thread is faded.",
  situationBody: (count: number) =>
    `The firm has met this situation on ${count} ${count === 1 ? "engagement" : "engagements"}.`,
  methodBody: (count: number) =>
    `The firm has used this method on ${count} ${count === 1 ? "engagement" : "engagements"}.`,
  relatedSituation: "How the work was done",
  relatedMethod: "Where it was used",
  openList: "Engagements",
  lesson: "Close-out lesson",
  deck: "Shown to client",
  kind: {
    situation: "Situation",
    method: "Method",
    lesson: "Close-out lesson",
    deck: "Engagement",
  } as Record<MapNodeKind, string>,
  of: (count: number, total: number) => `${count} of ${total}`,
  privacy:
    "Only work shared with the firm is drawn. Work that is not shared is not drawn and not counted. People are never points on the map.",
  key: {
    thread: "One engagement",
    situation: "Situation",
    method: "Method",
    end: "Lesson or client deck",
  },
  clear: "Clear",
} as const;

/** Map radii, as in the mock-up: situations outside, methods inside, each thread ending in its lesson and deck. */
const SITUATION_RADIUS = 245;
const METHOD_RADIUS = 92;
const LESSON_RADIUS = 186;
const DECK_RADIUS = 262;

const round = (value: number) => Math.round(value * 100) / 100;
const vec = (x: number, y: number, z: number): Vec3 => [round(x), round(y), round(z)];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const normalize = (a: Vec3): Vec3 => {
  const size = length(a);
  return size > 1e-9 ? scale(a, 1 / size) : [0, 0, 0];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** FNV-1a: the only source of variety in the layout, so positions follow ids, never chance. */
export function hashId(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const unit = (text: string) => hashId(text) / 0x100000000;

/** Point i of n spread evenly over a sphere (the golden angle). */
function sphere(i: number, n: number, offset: number): Vec3 {
  const y = 1 - (2 * (i + 0.5)) / n;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const t = i * 2.399963 + offset;
  return [Math.cos(t) * r, y, Math.sin(t) * r];
}

/** A direction picked by the id alone. */
function directionOf(id: string): Vec3 {
  const y = 1 - 2 * unit(`${id}:y`);
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const t = 2 * Math.PI * unit(`${id}:t`);
  return [Math.cos(t) * r, y, Math.sin(t) * r];
}

export const situationNodeId = (situation: Situation) => `situation:${situation}`;
export const methodNodeId = (method: Method) => `method:${method}`;
export const lessonNodeId = (threadId: string) => `lesson:${threadId}`;
export const deckNodeId = (threadId: string) => `deck:${threadId}`;
/** A whole engagement picked from the list or the reading panel, rather than one of its points. */
export const threadNodeId = (threadId: string) => `thread:${threadId}`;
const threadOfNodeId = (nodeId: string) =>
  nodeId.startsWith("thread:") ? nodeId.slice("thread:".length) : null;

/** What a thread is called on the map: its client, or its title for a board with no client. */
export function threadName(thread: Pick<FirmThread, "client" | "title">): string {
  return thread.client?.trim() || thread.title;
}

/** Counts drawn from the graph alone, so an unshared board can never change them. */
export function mapTotals(graph: FirmGraph): MapTotals {
  return {
    engagements: graph.threads.length,
    situations: graph.situations.length,
    methods: graph.methods.length,
    lessons: graph.threads.filter((thread) => thread.stops.some((stop) => stop.kind === "lesson"))
      .length,
  };
}

/**
 * The graph without lesson text, which the map never shows: a close-out line can name the people on the work, and
 * the map has no use for it. Everything else is the graph as assembled.
 */
export function forMap(graph: FirmGraph): FirmGraph {
  return {
    ...graph,
    threads: graph.threads.map((thread) => ({
      ...thread,
      stops: thread.stops.map((stop) => (stop.kind === "lesson" ? { ...stop, text: "" } : stop)),
    })),
  };
}

/**
 * Where everything sits. Situations and methods take fixed seats by their place in the vocabulary, so a point never
 * moves when another situation or method appears; each thread's lesson and deck sit along a direction hashed from its
 * board id. The same graph always gives the same layout.
 */
export function layoutFirmMap(graph: FirmGraph): FirmMapLayout {
  const nodes: MapNode[] = [];
  const byId = new Map<string, MapNode>();
  const put = (node: MapNode) => {
    nodes.push(node);
    byId.set(node.id, node);
  };

  for (const situation of graph.situations) {
    const p = scale(
      sphere(SITUATIONS.indexOf(situation.id), SITUATIONS.length, 0),
      SITUATION_RADIUS,
    );
    put({
      id: situationNodeId(situation.id),
      kind: "situation",
      label: situation.label,
      position: vec(...p),
      size: round(6.5 + situation.threadIds.length * 1.3),
      threadIds: [...situation.threadIds],
    });
  }
  for (const method of graph.methods) {
    const p = scale(sphere(METHODS.indexOf(method.id), METHODS.length, 1.3), METHOD_RADIUS);
    put({
      id: methodNodeId(method.id),
      kind: "method",
      label: method.label,
      position: vec(...p),
      size: round(4.6 + method.threadIds.length * 0.5),
      threadIds: [...method.threadIds],
    });
  }

  const threads: MapThread[] = [];
  for (const thread of graph.threads) {
    const situationNode = byId.get(situationNodeId(thread.situation));
    const situationDir = situationNode ? normalize(situationNode.position) : ([0, 1, 0] as Vec3);
    let dir = normalize(sub(scale(directionOf(thread.id), 0.95), situationDir));
    if (length(dir) === 0) dir = directionOf(thread.id);

    const nodeIds: string[] = situationNode ? [situationNode.id] : [];
    const methodLabels: string[] = [];
    let hasLesson = false;
    let hasDeck = false;
    for (const stop of thread.stops) {
      if (stop.kind === "method") {
        nodeIds.push(methodNodeId(stop.method));
        methodLabels.push(stop.label);
      } else if (stop.kind === "lesson") {
        hasLesson = true;
        const id = lessonNodeId(thread.id);
        put({
          id,
          kind: "lesson",
          label: FIRM_MAP_COPY.lesson,
          position: vec(...scale(dir, LESSON_RADIUS)),
          size: 2.9,
          threadIds: [thread.id],
        });
        nodeIds.push(id);
      } else if (stop.kind === "client_deck") {
        hasDeck = true;
        const id = deckNodeId(thread.id);
        put({
          id,
          kind: "deck",
          label: threadName(thread),
          position: vec(...scale(dir, DECK_RADIUS)),
          size: 3.5,
          threadIds: [thread.id],
        });
        nodeIds.push(id);
      }
    }

    const stops = nodeIds.map((id) => byId.get(id)!.position);
    const path: Vec3[] = stops.length > 1 ? [stops[0]!] : [];
    for (let i = 1; i < stops.length; i += 1) {
      const a = stops[i - 1]!;
      const b = stops[i]!;
      const hop = length(sub(b, a));
      const middle = scale(add(a, b), 0.5);
      const out = length(middle) > 1 ? normalize(middle) : ([0, 1, 0] as Vec3);
      const side = normalize(cross(sub(b, a), out));
      const sign = hashId(`${thread.id}:${i}`) % 2 ? 1 : -1;
      const control = add(add(middle, scale(out, hop * 0.26)), scale(side, hop * 0.1 * sign));
      path.push(vec(...control), b);
    }

    threads.push({
      id: thread.id,
      name: threadName(thread),
      title: thread.title,
      client: thread.client,
      startedOn: thread.startedOn,
      situationLabel: situationNode?.label ?? thread.situation,
      methodLabels,
      hasLesson,
      hasDeck,
      nodeIds,
      path,
    });
  }

  return { nodes, threads, totals: mapTotals(graph) };
}

/** A map point seen from one angle: x and y on screen, depth toward the viewer (larger is nearer). */
export type Projected = { x: number; y: number; depth: number; scale: number };

/** Turns a point by yaw (around the vertical) then pitch, and projects it with a gentle perspective. */
export function project(point: Vec3, yaw: number, pitch: number, distance = 900): Projected {
  const [x0, y0, z0] = point;
  const x1 = x0 * Math.cos(yaw) + z0 * Math.sin(yaw);
  const z1 = -x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
  const y2 = y0 * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = y0 * Math.sin(pitch) + z1 * Math.cos(pitch);
  const k = distance / (distance - z2);
  return { x: round(x1 * k), y: round(-y2 * k), depth: round(z2), scale: round(k) };
}

/** What the person has done on the map. Hover is a mouse resting on a point; pinned is a tap or click. */
export type MapState = {
  hover: string | null;
  pinned: string | null;
  /** The engagements the last firm answer quoted. Empty when none, or when it found nothing. */
  trace: string[];
  /** One thread held from the reading panel or the list. */
  focus: string | null;
};

export type MapAction =
  | { type: "hover"; nodeId: string | null }
  | { type: "pick"; nodeId: string | null }
  | { type: "trace"; threadIds: string[] }
  | { type: "focus"; threadId: string | null }
  | { type: "reset" };

export const INITIAL_MAP_STATE: MapState = { hover: null, pinned: null, trace: [], focus: null };

export function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case "hover":
      return state.hover === action.nodeId ? state : { ...state, hover: action.nodeId };
    case "pick":
      // Picking the pinned point again lets it go; picking empty stage clears the pin.
      return {
        ...state,
        pinned: action.nodeId === state.pinned ? null : action.nodeId,
        focus: null,
      };
    case "trace":
      // A new answer replaces whatever was pulled before, so the map shows that answer's proof.
      return { ...state, trace: [...action.threadIds], pinned: null, hover: null, focus: null };
    case "focus":
      return state.focus === action.threadId ? state : { ...state, focus: action.threadId };
    case "reset":
      return INITIAL_MAP_STATE;
  }
}

/** The point the reading panel describes: the pinned one, else the one under the mouse. */
export function selectedNode(state: MapState): string | null {
  return state.pinned ?? state.hover;
}

/**
 * The threads pulled tight, or null when nothing is pulled and every thread shows plainly. A held thread wins, then
 * the selected point's threads, then the last answer's trace. An empty trace pulls nothing and fades nothing.
 */
export function litThreads(state: MapState, layout: FirmMapLayout): Set<string> | null {
  if (state.focus && layout.threads.some((thread) => thread.id === state.focus))
    return new Set([state.focus]);
  const nodeId = selectedNode(state);
  const picked = nodeId ? threadOfNodeId(nodeId) : null;
  if (picked && layout.threads.some((thread) => thread.id === picked)) return new Set([picked]);
  const node = nodeId ? layout.nodes.find((entry) => entry.id === nodeId) : undefined;
  if (node) return new Set(node.threadIds);
  if (state.trace.length) return new Set(state.trace);
  return null;
}

/** Points on a pulled thread stay bright; the rest fade. Null means nothing is pulled. */
export function litNodes(lit: Set<string> | null, layout: FirmMapLayout): Set<string> | null {
  if (!lit) return null;
  return new Set(
    layout.nodes.filter((node) => node.threadIds.some((id) => lit.has(id))).map((node) => node.id),
  );
}

/**
 * Step 4, the answer trace: the engagements whose items the answer quoted, exactly, and only those on the map. A
 * "not found" answer and a refused people question pull nothing, whatever else they carry. No new AI call: the
 * answer already names the items it quoted.
 */
export function answerTrace(
  result: Pick<FirmAskResult, "status" | "claims" | "sources"> | null | undefined,
  threadIds: Iterable<string>,
): string[] {
  if (!result || result.status !== "answered") return [];
  const onMap = new Set(threadIds);
  const boards = new Set<string>();
  for (const claim of result.claims) {
    const boardId = result.sources[claim.itemId]?.boardId ?? claim.boardId;
    if (boardId && onMap.has(boardId)) boards.add(boardId);
  }
  return [...boards].sort();
}

/**
 * When each thread starts sewing on Replay, in milliseconds: oldest engagement first, by start date then id, spread
 * over at most `maxTotal` so a large firm still finishes in a few seconds.
 */
export function replayDelays(
  layout: FirmMapLayout,
  options: { step?: number; maxTotal?: number } = {},
): Map<string, number> {
  const ordered = [...layout.threads].sort(
    (a, b) => a.startedOn.localeCompare(b.startedOn) || a.id.localeCompare(b.id),
  );
  const step = Math.min(
    options.step ?? 160,
    (options.maxTotal ?? 4000) / Math.max(1, ordered.length),
  );
  return new Map(ordered.map((thread, index) => [thread.id, Math.round(index * step)]));
}

/** What the reading panel shows for the current state. */
export type MapReading =
  | { kind: "overview"; totals: MapTotals }
  | { kind: "trace"; threads: MapThread[] }
  | {
      kind: "node";
      node: MapNode;
      threads: MapThread[];
      related: { label: string; count: number }[];
    }
  | { kind: "thread"; thread: MapThread };

/**
 * A held thread (hovering a row in the panel) only pulls it on the map; the panel keeps what it was showing, so the
 * row under the pointer never moves.
 */
export function readingFor(state: MapState, layout: FirmMapLayout): MapReading {
  const threadById = new Map(layout.threads.map((thread) => [thread.id, thread]));
  const nodeId = selectedNode(state);
  const picked = nodeId ? threadById.get(threadOfNodeId(nodeId) ?? "") : undefined;
  if (picked) return { kind: "thread", thread: picked };
  const node = nodeId ? layout.nodes.find((entry) => entry.id === nodeId) : undefined;
  if (node) {
    const threads = node.threadIds.flatMap((id) => threadById.get(id) ?? []);
    if (node.kind === "lesson" || node.kind === "deck")
      return { kind: "thread", thread: threads[0]! };
    const counts = new Map<string, number>();
    for (const thread of threads) {
      const labels =
        node.kind === "situation" ? new Set(thread.methodLabels) : new Set([thread.situationLabel]);
      for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const related = [...counts]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return { kind: "node", node, threads, related };
  }
  if (state.trace.length)
    return { kind: "trace", threads: state.trace.flatMap((id) => threadById.get(id) ?? []) };
  return { kind: "overview", totals: layout.totals };
}

/** The plain list: engagements grouped by situation, in vocabulary order, oldest first within each. */
export function listBySituation(
  layout: FirmMapLayout,
): { nodeId: string; label: string; threads: MapThread[] }[] {
  return layout.nodes
    .filter((node) => node.kind === "situation")
    .map((node) => ({
      nodeId: node.id,
      label: node.label,
      threads: layout.threads.filter((thread) => thread.nodeIds[0] === node.id),
    }))
    .filter((group) => group.threads.length > 0);
}

/**
 * Who sees the map: everyone who sees Ask the firm (a company workspace, not a coach),
 * except guests. The server gate (requireFirmMember) checks all of it again.
 */
export function canSeeFirmMap(
  profile:
    | {
        role?: string | null;
        has_firm_view?: boolean | null;
        org_type?: string | null;
        is_guest?: boolean | null;
      }
    | null
    | undefined,
): boolean {
  return canAskTheFirm(profile) && profile?.is_guest !== true;
}
