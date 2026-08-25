/**
 * Pass 114: the serpentine story path. The Work Artifact spine stops being a
 * straight stem and becomes a winding, hand-drawn route that walks the record
 * from one work item to the next.
 *
 * Everything here is pure and deterministic: the same set of item ids always
 * produces the same path, because the wander comes from a seeded generator
 * keyed on those ids and never from Math.random. Timing lives here too, as one
 * pure function of beat, so the CSS only ever reads a delay.
 */

import { inkPathD, type Point } from "@/lib/lasso-geometry";

/* --------------------------------------------------------------------------
   Seeded randomness
-------------------------------------------------------------------------- */

/** FNV-1a over a string, the seed for a whole path. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Mulberry32. Small, fast, and identical everywhere it runs. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One draw per index, keyed on the item ids rather than on positions, so the
 * same record always wanders the same way and a different record does not.
 */
export function seededRand(ids: readonly string[]): (index: number) => number {
  const seed = fnv1a(ids.join("|"));
  return (index: number) => mulberry32((seed + Math.imul(index, 0x9e3779b1)) >>> 0)();
}

/* --------------------------------------------------------------------------
   The timeline. One pure function of beat, in seconds.
-------------------------------------------------------------------------- */

/** The title settles first, at zero. */
export const T_TITLE = 0;

/** Beat spacing per node, compressed a little once the record is long. */
export function nodeStepS(count: number): number {
  return count > 6 ? 2.0 : 2.6;
}

/** When node i begins its arrival, in seconds. */
export function nodeBeatS(index: number, count: number): number {
  return 0.9 + index * nodeStepS(count);
}

/** When the sections act begins, overlapping the spine finale on purpose. */
export function sectionsStartS(count: number): number {
  return count > 0 ? nodeBeatS(count - 1, count) + 1.4 : 1.4;
}

export function sectionsStartMs(count: number): number {
  return Math.round(sectionsStartS(count) * 1000);
}

/** Offsets inside a node's own arrival, in seconds. */
export const NODE_SEGMENT_OFFSET_S = 0;
export const NODE_ARROW_OFFSET_S = 0.55;
export const NODE_CARD_OFFSET_S = 0.8;
export const NODE_FIREWORK_OFFSET_S = 1.0;
export const NODE_STITCH_OFFSET_S = 1.5;

export function beatMs(seconds: number): number {
  return Math.round(seconds * 1000);
}

/* --------------------------------------------------------------------------
   The geometry
-------------------------------------------------------------------------- */

export const JOURNEY_CARD_H = 92;
export const JOURNEY_NARROW_W = 460;

export type PathNode = { id: string; x: number; y: number; w: number; h: number };

export type PathStroke = { d: string; length: number };

export type PathSegment = {
  /** The node this segment arrives at. */
  toId: string;
  stroke: PathStroke;
  /** Two hand-drawn strokes meeting at the tip, drawn after the segment. */
  arrow: PathStroke[];
};

export type PathTendril = {
  /** The node whose stitches hang off this tendril. */
  nodeId: string;
  stroke: PathStroke;
  /** Where the stitch block sits, in path coordinates. */
  end: Point;
};

export type JourneyPath = {
  width: number;
  height: number;
  nodes: PathNode[];
  segments: PathSegment[];
  tendrils: PathTendril[];
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function polyLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return Math.round(total * 100) / 100;
}

/**
 * A straight run, subdivided and nudged off true so it reads as a pencil line
 * rather than a ruler one.
 */
function waverRun(from: Point, to: Point, draw: (k: number) => number, base: number): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return [{ x: round(to.x), y: round(to.y) }];
  const step = 26 + draw(base) * 8;
  const steps = Math.max(1, Math.round(distance / step));
  const nx = -dy / distance;
  const ny = dx / distance;
  const out: Point[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const wobble = i === steps ? 0 : (draw(base + i) * 2 - 1) * 1.5;
    out.push({
      x: round(from.x + dx * t + nx * wobble),
      y: round(from.y + dy * t + ny * wobble),
    });
  }
  return out;
}

function strokeFrom(points: Point[]): PathStroke {
  return { d: inkPathD(points), length: polyLength(points) };
}

/** A hand-drawn arrowhead: two wavering strokes meeting at the tip. */
function arrowAt(tip: Point, tangent: Point, draw: (k: number) => number, base: number): PathStroke[] {
  const angle = Math.atan2(tangent.y, tangent.x);
  const half = (57 * Math.PI) / 180 / 2;
  return [-1, 1].map((side, index) => {
    const back = angle + Math.PI + side * half;
    const end = { x: tip.x + Math.cos(back) * 11, y: tip.y + Math.sin(back) * 11 };
    const wobble = (draw(base + index) * 2 - 1) * 1;
    const mid = {
      x: (tip.x + end.x) / 2 - Math.sin(back) * wobble,
      y: (tip.y + end.y) / 2 + Math.cos(back) * wobble,
    };
    const points = [
      { x: round(tip.x), y: round(tip.y) },
      { x: round(mid.x), y: round(mid.y) },
      { x: round(end.x), y: round(end.y) },
    ];
    return strokeFrom(points);
  });
}

/**
 * The whole route. Nodes alternate lanes, each segment drops, travels across
 * and drops again, and every corner is rounded by the same smoothing the ink
 * elsewhere uses.
 */
export function buildJourneyPath(input: {
  ids: readonly string[];
  width?: number | undefined;
  stitchCounts?: Readonly<Record<string, number>> | undefined;
}): JourneyPath {
  const ids = input.ids;
  const stitchCounts = input.stitchCounts ?? {};
  const width = Math.max(380, Math.min(720, Math.round(input.width || 640)));
  const narrow = width < JOURNEY_NARROW_W;
  const rand = seededRand(ids);
  const draw = (k: number) => rand(k + 1);
  const pick = (i: number, k: number) => draw(i * 11 + k);
  const seed = fnv1a(ids.join("|"));

  const cardW = Math.round(narrow ? width * 0.62 : Math.min(300, width * 0.44));
  const laneLeft = narrow ? width * 0.38 : width * 0.22;
  const laneRight = narrow ? width * 0.62 : width * 0.78;
  const jitter = narrow ? width * 0.02 : width * 0.04;
  const startLeft = seed % 2 === 0;

  const nodes: PathNode[] = [];
  let y = JOURNEY_CARD_H / 2 + 8;
  for (let i = 0; i < ids.length; i += 1) {
    const onLeft = startLeft ? i % 2 === 0 : i % 2 === 1;
    const lane = onLeft ? laneLeft : laneRight;
    const raw = lane + jitter * (pick(i, 0) * 2 - 1);
    const min = cardW / 2 + 4;
    const max = width - cardW / 2 - 4;
    nodes.push({
      id: ids[i] as string,
      x: round(Math.min(max, Math.max(min, raw))),
      y: round(y),
      w: cardW,
      h: JOURNEY_CARD_H,
    });
    y += 150 + pick(i, 6) * 70 + ((stitchCounts[ids[i] as string] ?? 0) > 0 ? 80 : 0);
  }

  const segments: PathSegment[] = [];
  const tendrils: PathTendril[] = [];

  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i] as PathNode;
    const next = nodes[i + 1];

    let horizontal: { from: Point; to: Point } | null = null;

    if (next) {
      const start = { x: a.x, y: a.y + JOURNEY_CARD_H / 2 };
      const endY = next.y - JOURNEY_CARD_H / 2 - 10;
      const fraction = 0.35 + pick(i, 1) * 0.2;
      const y1 = start.y + (endY - start.y) * fraction;

      const corners: Point[] = [start, { x: a.x, y: y1 }];
      if (pick(i, 2) > 0.7) {
        const direction = next.x >= a.x ? 1 : -1;
        const jogX = a.x + direction * (24 + pick(i, 3) * 16);
        corners.push({ x: jogX, y: y1 }, { x: jogX, y: y1 + 20 });
      }
      const last = corners[corners.length - 1] as Point;
      const acrossFrom = { x: last.x, y: last.y };
      const acrossTo = { x: next.x, y: last.y };
      corners.push(acrossTo, { x: next.x, y: endY });
      if (Math.abs(acrossTo.x - acrossFrom.x) > 40) horizontal = { from: acrossFrom, to: acrossTo };

      const points: Point[] = [{ x: round(start.x), y: round(start.y) }];
      for (let c = 1; c < corners.length; c += 1) {
        points.push(
          ...waverRun(corners[c - 1] as Point, corners[c] as Point, draw, i * 97 + c * 13),
        );
      }
      const tip = points[points.length - 1] as Point;
      const before = points[points.length - 2] ?? tip;
      const tangent = { x: tip.x - before.x, y: tip.y - before.y || 1 };
      segments.push({
        toId: next.id,
        stroke: strokeFrom(points),
        arrow: arrowAt(tip, tangent, draw, i * 31 + 3),
      });
    }

    // The tendril the stitches hang from, whether or not there is a run to hang it on.
    const dropLength = 30 + pick(i, 4) * 14;
    const drift = (pick(i, 5) > 0.5 ? 1 : -1) * 6;
    const from = horizontal
      ? {
          x: horizontal.from.x + (horizontal.to.x - horizontal.from.x) * 0.3,
          y: horizontal.from.y,
        }
      : {
          x: a.x + (a.x <= width / 2 ? cardW / 2 : -cardW / 2),
          y: a.y + JOURNEY_CARD_H * 0.1,
        };
    const nextCardTop = next ? next.y - JOURNEY_CARD_H / 2 : Number.POSITIVE_INFINITY;
    const to = {
      x: from.x + drift,
      y: Math.min(from.y + dropLength, nextCardTop - 60),
    };
    const points = [{ x: round(from.x), y: round(from.y) }, ...waverRun(from, to, draw, i * 53 + 7)];
    tendrils.push({ nodeId: a.id, stroke: strokeFrom(points), end: { x: round(to.x), y: round(to.y) } });
  }

  const lastNode = nodes[nodes.length - 1];
  const height = lastNode ? round(lastNode.y + JOURNEY_CARD_H / 2 + 24) : 0;

  return { width, height, nodes, segments, tendrils };
}
