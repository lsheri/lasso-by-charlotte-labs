/**
 * Pass 142: the spiral settle. Every time the work pile mounts, the papers
 * sweep in along an inward spiral around the pile's centre and settle into the
 * positions the layout already computed. Layout space is render space: only
 * transforms move, so nothing reflows and no scrollbar jumps.
 *
 * Everything here is seeded from the item id, never Math.random, so the same
 * pile deals the same way twice and tests can assert it.
 */

import { hashId } from "@/components/work/pile-scatter";

/** Floor for the whole settle, before the per item growth. */
export const SPIRAL_BASE_MS = 1600;
/** How much each piece of work adds to the settle. */
export const SPIRAL_PER_ITEM_MS = 120;
/** Hard cap: the desk is always dealt inside six seconds. */
export const SPIRAL_MAX_MS = 6000;
/** Roughly how many turns a paper travels before it rests. */
export const SPIRAL_TURNS = 1.25;
/** The sweep between one paper and the next, before compression. */
export const SPIRAL_STAGGER_MS = 40;

/** Total settle time: grows with the pile, clamped at the cap. */
export function spiralDurationMs(count: number): number {
  const n = Math.max(0, Math.floor(count));
  return Math.min(SPIRAL_BASE_MS + n * SPIRAL_PER_ITEM_MS, SPIRAL_MAX_MS);
}

/**
 * The stagger compresses so the last paper still lands inside the total. Half
 * the window is the most the sweep is ever allowed to eat.
 */
export function spiralStaggerMs(count: number): number {
  const n = Math.max(0, Math.floor(count));
  if (n <= 1) return 0;
  const window = spiralDurationMs(n) * 0.5;
  return Math.min(SPIRAL_STAGGER_MS, Math.floor(window / (n - 1)));
}

/** Small deterministic PRNG, seeded from the item id hash. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SpiralStart = {
  /** Starting offset from the resting position, in pixels. */
  dx: number;
  dy: number;
  /** Starting rotation, in degrees. */
  rot: number;
  /** When this paper begins its travel. */
  delayMs: number;
  /** How long this paper travels. */
  durationMs: number;
};

/**
 * Where one paper starts. The angle and radius come from the id; the place in
 * the sweep comes from the index, so the pile reads as a gather rather than a
 * blob arriving at once.
 */
export function spiralStartFor(
  id: string,
  index: number,
  count: number,
  diagonal: number,
): SpiralStart {
  const n = Math.max(1, Math.floor(count));
  const random = mulberry32(hashId(id));
  const spin = random();
  const jitter = random();
  const frac = n === 1 ? 0 : index / (n - 1);

  const outer = Math.max(120, diagonal * 0.6);
  const angle = spin * Math.PI * 2 + SPIRAL_TURNS * Math.PI * 2 * frac;
  const radius = outer * (1 - 0.45 * frac) * (0.6 + 0.4 * jitter);

  const stagger = spiralStaggerMs(n);
  const total = spiralDurationMs(n);

  return {
    dx: Math.round(Math.cos(angle) * radius),
    dy: Math.round(Math.sin(angle) * radius),
    rot: Math.round((spin * 24 - 12) * 10) / 10,
    delayMs: stagger * index,
    durationMs: Math.max(240, total - stagger * (n - 1)),
  };
}
