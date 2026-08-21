/**
 * Where a paper lands on the scatter field. Deterministic per item id: the same
 * piece of work sits in the same place on every render, so nothing reflows
 * under the cursor and tests can assert positions without seeding randomness.
 */
export type ScatterOffset = { dx: number; dy: number; rot: number };

/** Small, stable string hash (FNV-1a, 32 bit). */
export function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Offsets stay inside the field, rotation stays under 3 degrees. */
export function scatterFor(id: string): ScatterOffset {
  const hash = hashId(id);
  const dx = ((hash % 41) - 20) * 0.9; // about -18px .. 18px
  const dy = (((hash >>> 7) % 33) - 16) * 0.9; // about -14px .. 14px
  const rot = (((hash >>> 13) % 61) - 30) / 10; // -3.0deg .. 3.0deg
  return {
    dx: Math.round(dx * 10) / 10,
    dy: Math.round(dy * 10) / 10,
    rot: Math.round(rot * 10) / 10,
  };
}

/** How many papers the field scatters before it says "+N more". */
export const SCATTER_CAP = 30;
