/**
 * 21 Nov 2026, D-85 PR B (Liam: "home page prototypes you made with 3d orb as center for non admins"): the firm map as
 * a slowly turning sphere at the centre of Home. Situations sit on the outer shell, methods on an inner one, each
 * engagement near its situation, and each engagement's thread runs from its situation through its methods to it.
 * Asking turns the sphere to the engagements the answer quoted and pulls them into a tight row at the front.
 *
 * Pure: the model, the cap that keeps it smooth on an ordinary laptop, rotation, projection, the turn to face the
 * answer, and the words. The data is the same canvas data the server sends (fees for admins and leads only).
 */

import type { FirmCanvasData } from "./firm-canvas-shared";
import { hashId, threadName } from "./firm-map-shared";

export type V3 = readonly [number, number, number];

/** The most engagements drawn on the sphere. The most recent win; the ones an answer quoted are always drawn. */
export const MAX_ORB_THREADS = 160;
/** Points per thread segment: enough for a smooth curve, few enough for 160 threads at 60 frames a second. */
const SEGMENT_STEPS = 12;

export type OrbNode = { id: string; p: V3; label: string };
export type OrbThread = { id: string; name: string; fee: string | null; end: V3; points: V3[] };
export type OrbModel = {
  situations: OrbNode[];
  methods: OrbNode[];
  threads: OrbThread[];
  total: number;
};

/** n points spread evenly over a sphere of radius r (a Fibonacci lattice). */
export function fibonacciSphere(n: number, r: number): V3[] {
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / Math.max(1, n);
    const k = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.399963;
    return [Math.cos(a) * k * r, y * r, Math.sin(a) * k * r] as const;
  });
}

const unit = (seed: number) => (seed % 10_000) / 10_000;

function normalise(v: V3, length: number): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [(v[0] / l) * length, (v[1] / l) * length, (v[2] / l) * length];
}

function catmull(a: V3, b: V3, c: V3, d: V3, t: number): V3 {
  const out = [0, 0, 0] as [number, number, number];
  for (let i = 0; i < 3; i += 1) {
    out[i] =
      0.5 *
      (2 * b[i]! +
        (c[i]! - a[i]!) * t +
        (2 * a[i]! - 5 * b[i]! + 4 * c[i]! - d[i]!) * t * t +
        (3 * b[i]! - a[i]! - 3 * c[i]! + d[i]!) * t * t * t);
  }
  return out;
}

/** The threads to draw: the most recent up to the cap, plus every one in `keep`. */
export function capThreads<T extends { id: string; startedOn: string }>(
  threads: readonly T[],
  keep: ReadonlySet<string> = new Set(),
): T[] {
  if (threads.length <= MAX_ORB_THREADS) return [...threads];
  const recent = [...threads]
    .sort((a, b) => b.startedOn.localeCompare(a.startedOn) || a.id.localeCompare(b.id))
    .slice(0, MAX_ORB_THREADS);
  const chosen = new Set(recent.map((thread) => thread.id));
  return threads.filter((thread) => chosen.has(thread.id) || keep.has(thread.id));
}

/**
 * The sphere for this firm. The same data always gives the same sphere: places come from the vocabulary order and a
 * hash of each board id, never from chance.
 */
export function orbModel(data: FirmCanvasData, keep: ReadonlySet<string> = new Set()): OrbModel {
  const situationAt = new Map(
    data.situations.map((s, i, all) => [s.id, fibonacciSphere(all.length, 1)[i]!]),
  );
  const methodAt = new Map(
    data.methods.map((m, i, all) => [m.id, fibonacciSphere(all.length, 0.42)[i]!]),
  );
  const situations = data.situations.map((s) => ({
    id: s.id,
    p: situationAt.get(s.id)!,
    label: s.label,
  }));
  const methods = data.methods.map((m) => ({ id: m.id, p: methodAt.get(m.id)!, label: m.label }));
  const threads: OrbThread[] = capThreads(data.threads, keep).flatMap((thread) => {
    const hub = situationAt.get(thread.situation);
    if (!hub) return [];
    const h = hashId(thread.id);
    const jitter: V3 = [
      unit(h) - 0.5,
      unit(Math.floor(h / 7)) - 0.5,
      unit(Math.floor(h / 49)) - 0.5,
    ];
    const end = normalise(
      [
        hub[0] * 0.55 + jitter[0] * 1.1,
        hub[1] * 0.55 + jitter[1] * 1.1,
        hub[2] * 0.55 + jitter[2] * 1.1,
      ],
      0.74 + unit(Math.floor(h / 343)) * 0.42,
    );
    const via: V3[] = [hub];
    for (const stop of thread.stops) {
      if (stop.kind !== "method") continue;
      const at = methodAt.get(stop.method);
      if (at && via.length < 3) via.push(at);
    }
    via.push(end);
    const points: V3[] = [];
    for (let k = 0; k < via.length - 1; k += 1) {
      for (let t = 0; t < SEGMENT_STEPS; t += 1) {
        points.push(
          catmull(
            via[Math.max(0, k - 1)]!,
            via[k]!,
            via[k + 1]!,
            via[Math.min(via.length - 1, k + 2)]!,
            t / SEGMENT_STEPS,
          ),
        );
      }
    }
    points.push(end);
    return [
      { id: thread.id, name: threadName(thread), fee: data.fees?.[thread.id] ?? null, end, points },
    ];
  });
  return { situations, methods, threads, total: data.threads.length };
}

/** Turns a point by `angle` round the vertical, then tips it towards the viewer a little, as the landing page does. */
export function rotate(p: V3, angle: number): V3 {
  const x = p[0] * Math.cos(angle) + p[2] * Math.sin(angle);
  const z = -p[0] * Math.sin(angle) + p[2] * Math.cos(angle);
  return [x, p[1] * 0.95 - z * 0.31, p[1] * 0.31 + z * 0.95];
}

export type Projected = { x: number; y: number; z: number; k: number };

/** Where a turned point lands on a canvas of width w and height h, with a little perspective. */
export function project(r: V3, w: number, h: number): Projected {
  const radius = Math.min(w * 0.4, h * 0.42);
  const k = 3.1 / (3.1 - r[2]);
  return { x: w / 2 + r[0] * radius * k, y: h / 2 + r[1] * radius * k, z: r[2], k };
}

/** The angle that brings the given engagements most to the front. */
export function facingAngle(model: OrbModel, ids: readonly string[]): number | null {
  const ends = model.threads
    .filter((thread) => ids.includes(thread.id))
    .map((thread) => thread.end);
  if (!ends.length) return null;
  let best = 0;
  let bestZ = -Infinity;
  for (let a = 0; a < Math.PI * 2; a += 0.04) {
    const z = ends.reduce((sum, end) => sum + rotate(end, a)[2], 0);
    if (z > bestZ) {
      bestZ = z;
      best = a;
    }
  }
  return best;
}

/** The shortest turn from one angle to another, so the sphere never spins the long way round. */
export function shortestTurn(from: number, to: number): number {
  const full = Math.PI * 2;
  return ((((to - from) % full) + full + Math.PI) % full) - Math.PI;
}

/** Where the i-th of n pulled engagements sits: a row at the front of the sphere, staggered up and down. */
export function pulledPlace(index: number, count: number): V3 {
  return [(index - (count - 1) / 2) * 0.52, index % 2 ? 0.1 : -0.1, 1.02];
}

/** How fast the sphere turns at rest: a full turn in about 80 seconds. */
export const ORB_SPIN_PER_MS = 0.00008;

export const ORB_COPY = {
  label:
    "The firm's past work as a turning sphere: every thread is one engagement shared with the firm.",
  hint: "Ask anything about past work. Every line of the answer shows where it came from.",
  found: (n: number) => (n === 1 ? "Found it in 1 engagement" : `Found it in ${n} engagements`),
  opening: "Opening it on Firm brain",
  nothing: "Nothing shared with the firm matches yet. Opening Firm brain to show what was read.",
  empty: "Nothing is shared with the firm yet.",
  /** 20 Nov 2026, chat pill PR 1b: the one next step, where the orb would be. */
  emptyNext: "Share a finished board with the firm and it appears here.",
  /** Under the orb (D-97 prototype): how much the firm can learn from. */
  learnFrom: (n: number) => (n === 1 ? "1 past engagement the firm can learn from" : `${n} past engagements the firm can learn from`),
  failed: "That did not work. Try again.",
  tryAgain: "Try again",
} as const;
