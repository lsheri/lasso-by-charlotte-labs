/* Charlotte mark geometry: the Monoline C (Thin) and the growing web, ported from the 13 Nov spec
   (Drive: SPEC 13 Nov, section 3). Pure maths returning path data and numbers, never HTML strings.
   Everything sits on a 64 viewBox, centre 32, radius 23, with the C's gap from 315 to 45 degrees. */

export const MARK_R = 23;
/** One cycle: a 4.4s grow (easeInOutQuad), a hold, then a fade from 6.0s to 6.4s. */
export const CYCLE_S = 6.4;
export const GROW_S = 4.4;
export const FADE_FROM_S = 6.0;

export type MarkWeight = "regular" | "thin" | "hair";

export const f = (n: number) => Math.round(n * 100) / 100;

export function P(r: number, deg: number, cx = 32, cy = 32): string {
  const a = (deg * Math.PI) / 180;
  return `${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`;
}

export function even(n: number, rot = -90): number[] {
  return Array.from({ length: n }, (_, i) => rot + (i * 360) / n);
}

export function spokesD(r: number, angles: readonly number[]): string {
  return angles.map((a) => `M32 32L${P(r, a)}`).join("");
}

/** Sagging rings between spokes: one closed loop per radius factor in ks. */
export function sag(
  r: number,
  angles: readonly number[],
  ks: readonly number[],
  depth = 0.8,
): string {
  let d = "";
  const n = angles.length;
  for (const k of ks) {
    d += `M${P(r * k, angles[0]!)}`;
    for (let i = 0; i < n; i++) {
      const a0 = angles[i]!;
      let a1 = angles[(i + 1) % n]!;
      if (a1 < a0) a1 += 360;
      d += `Q${P(r * k * depth, (a0 + a1) / 2)} ${P(r * k, a1)}`;
    }
  }
  return d;
}

const WEIGHTS: Record<MarkWeight, { big: number; small: number }> = {
  regular: { big: 1, small: 1 },
  thin: { big: 0.55, small: 0.75 },
  hair: { big: 0.34, small: 0.6 },
};

/** Stroke weights for a size. At 24px and below the mark is "small": heavier strokes, a bigger hub, no nodes. */
export function wmVars(size: number, weight: MarkWeight = "thin") {
  const small = size <= 24;
  const w = WEIGHTS[weight];
  const k = small ? w.small : w.big;
  return {
    small,
    k,
    sw: f((small ? 5.2 : 3.6) * k),
    ws: f((small ? 3.4 : 1.8) * k),
    hub: small ? 6.5 : 4,
  };
}

/** Weights for the web (reading, and the finished web under reduced motion). Above 24px it is the 32px look,
    the same as the C. At 24px and below it is a smaller web, thinner, with a smaller live hub (Liam, 14 Nov),
    instead of the spec's heavier small weights, which stay on the still C. */
export function webVars(size: number, weight: MarkWeight = "thin") {
  const v = wmVars(size, weight);
  if (!v.small) return v;
  // Set in screen pixels so it reads as the 32px web, smaller: a 1px rim at 24 (0.8px at 16), 0.5px strands.
  const px = 64 / size;
  return { small: true, k: 0.6, sw: f((size >= 24 ? 1 : 0.8) * px), ws: f(0.5 * px), hub: 4.5 };
}

/** The still Monoline C: three spokes and the open arc. */
export const MONO_SPOKES = spokesD(MARK_R, [180, 225, 135]);
export const MONO_ARC = `M${P(MARK_R, 315)}A${MARK_R} ${MARK_R} 0 1 0 ${P(MARK_R, 45)}`;

export const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const win = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Spoke angle and start; the first three are the C's own spokes and are always drawn. */
export const GROW_SPOKES = [
  { a: 180, s: 0 },
  { a: 225, s: 0 },
  { a: 135, s: 0 },
  { a: 270, s: 0.04 },
  { a: 90, s: 0.12 },
  { a: 315, s: 0.2 },
  { a: 45, s: 0.28 },
  { a: 0, s: 0.36 },
] as const;

/** Ring radius factor and its draw window in p. Below 24px only the inner ring draws. */
const RINGS = [
  { k: 0.45, from: 0.5, to: 0.8 },
  { k: 0.75, from: 0.62, to: 0.96 },
] as const;

const A8 = even(8, -90);

export type MarkFrame = {
  /** True once the web is complete (p = 1). */
  done: boolean;
  spokes: string;
  /** Half the gap, in degrees: 45 open, 0 closed. */
  gap: number;
  arc: string;
  /** One entry per ring; offset 1 is undrawn, 0 fully drawn (stroke-dashoffset on pathLength 1). */
  rings: { d: string; offset: number; visible: boolean }[];
  nodes: { cx: number; cy: number; r: number }[];
};

/** The growing web at progress p (0 to 1). */
export function growFrame(p: number, size: number): MarkFrame {
  const { small } = wmVars(size);
  const r = MARK_R;
  let spokes = "";
  const nodes: MarkFrame["nodes"] = [];
  GROW_SPOKES.forEach((o, i) => {
    const t = i < 3 ? 1 : win(p, o.s, o.s + 0.14);
    if (t <= 0) return;
    spokes += `M32 32L${P(r * t, o.a)}`;
    const nt = i < 3 ? 1 : win(p, o.s + 0.1, o.s + 0.2);
    if (nt > 0 && !small) {
      const [cx, cy] = P(r, o.a).split(" ").map(Number);
      nodes.push({ cx: cx!, cy: cy!, r: f(3 * nt) });
    }
  });
  const gap = 45 * (1 - win(p, 0.3, 0.7));
  const arc =
    gap < 0.6
      ? `M${32 + r} 32A${r} ${r} 0 1 1 ${32 - r} 32A${r} ${r} 0 1 1 ${32 + r} 32`
      : `M${P(r, -gap)}A${r} ${r} 0 1 0 ${P(r, gap)}`;
  const rings = RINGS.map((q) => {
    const t = win(p, q.from, q.to);
    return {
      d: sag(r, A8, [q.k]),
      offset: f(1 - t),
      visible: t > 0 && !(size < 24 && q.k === 0.75),
    };
  });
  return { done: p >= 1, spokes, gap, arc, rings, nodes };
}

/** Where a running cycle is at t seconds: eased growth progress and the fade-out opacity. */
export function cycleAt(tSeconds: number): { p: number; opacity: number } {
  const t = ((tSeconds % CYCLE_S) + CYCLE_S) % CYCLE_S;
  const p = ease(clamp(t / GROW_S));
  const opacity = t < FADE_FROM_S ? 1 : f(1 - (t - FADE_FROM_S) / (CYCLE_S - FADE_FROM_S));
  return { p, opacity };
}

/** Suggest workstreams (G6, Liam 14 Nov: option B): the open C with three dots in a row, no spokes. In a row,
    not a triangle, so it reads as Lasso thinking rather than a face. */
export function suggestDots(size: number) {
  const r = wmVars(size).small ? 3.2 : 2.4;
  return [
    [24, 32],
    [32, 32],
    [40, 32],
  ].map(([cx, cy]) => ({ cx: cx!, cy: cy!, r }));
}

/** The lapel tile (future app icon and avatar): the C on navy with a lime hub, on a smaller radius of 19. */
export function tileGeometry(size: number, radius?: number) {
  const small = size <= 24;
  const k = small ? 0.75 : 0.55;
  const rad = radius ?? Math.round(size * 0.22);
  return {
    rx: f((rad * 64) / size),
    spokes: spokesD(19, [180, 225, 135]),
    spokeWidth: f(1.8 * k * (small ? 1.9 : 1)),
    arc: `M${P(19, 315)}A19 19 0 1 0 ${P(19, 45)}`,
    arcWidth: f(3.6 * k * (small ? 1.45 : 1)),
    hub: small ? 5.5 : 3.6,
  };
}
