export const LOOP_STAMPS = 48;
export const LOOP_DOTS = 5;
export const LOOP_CYCLE_MS = 5200;
export const LOOP_SUPER_PERIOD = 3;
export const LOOP_SEQUENCE_LENGTH = 5;

export const LOOP_RX_RATIO = 0.31;
export const LOOP_KY = 0.92;
export const LOOP_DOT_RADIUS_BOOST = 0.38;
export const LOOP_DOT_ALPHA_FADE = 0.18;

export const LOOP_SIZE_TOOLBAR = 36;
export const LOOP_SIZE_TITLE = 72;
export const LOOP_SIZE_CHAT = 28;

export type LoopStamp = {
  x: number;
  y: number;
  z: number;
  radius: number;
  alpha: number;
  cluster: number;
};

export type LassoMotionPhase = "clock" | "horizon" | "loose" | "lasso";
export type LassoResolvedForm = 0 | 1 | 2 | 3 | 4;

type ShapePoint = { x: number; y: number; z?: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function easeBetween(value: number, from: number, to: number): number {
  return easeInOutCubic(clamp((value - from) / (to - from), 0, 1));
}

function cyclePhase(value: number): number {
  const wrapped = ((value % 1) + 1) % 1;
  return Math.round(wrapped * 1_000_000_000_000) / 1_000_000_000_000;
}

export function cohesionAt(phase: number): number {
  const p = cyclePhase(phase);
  if (p < 0.54) return 0;
  if (p < 0.7) return easeOutCubic((p - 0.54) / 0.16);
  if (p < 0.88) return 1;
  return 1 - easeInOutCubic((p - 0.88) / 0.12);
}

export function turnFractionAt(phase: number): number {
  const p = cyclePhase(phase);
  if (p < 0.18) return 0.12 * (p / 0.18);
  if (p < 0.34) return 0.12 + 0.18 * easeOutCubic((p - 0.18) / 0.16);
  if (p < 0.54) return 0.3 + 0.28 * easeInOutCubic((p - 0.34) / 0.2);
  if (p < 0.88) return 0.58 + 0.08 * ((p - 0.54) / 0.34);
  return 0.66 + 0.34 * easeInOutCubic((p - 0.88) / 0.12);
}

export function motionPhaseAt(phase: number): LassoMotionPhase {
  const p = cyclePhase(phase);
  if (p < 0.18 || p >= 0.88) return "clock";
  if (p < 0.34) return "horizon";
  if (p < 0.7) return "loose";
  return "lasso";
}

export function stampRadiusFor(size: number): number {
  if (size <= 0) return 0.62;
  return clamp(0.029 * size * Math.pow(36 / size, 0.38), 0.62, 1.72);
}

function shortestArc(from: number, to: number): number {
  const full = Math.PI * 2;
  return ((to - from + Math.PI) % full + full) % full - Math.PI;
}

function grain(index: number, salt: number): number {
  let value = Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt + 11, 0x27d4eb2d);
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 0xffffffff;
}

function polylinePoint(points: ShapePoint[], progress: number): ShapePoint {
  const clamped = clamp(progress, 0, 1);
  const scaled = clamped * (points.length - 1);
  const fromIndex = Math.min(Math.floor(scaled), points.length - 2);
  const amount = scaled - fromIndex;
  const from = points[fromIndex] ?? points[0] ?? { x: 0.5, y: 0.5 };
  const to = points[fromIndex + 1] ?? from;
  return {
    x: mix(from.x, to.x, amount),
    y: mix(from.y, to.y, amount),
    z: mix(from.z ?? 0, to.z ?? 0, amount),
  };
}

function arcPoint(
  progress: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  start: number,
  sweep: number,
): ShapePoint {
  const angle = start + sweep * clamp(progress, 0, 1);
  return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle), z: Math.sin(angle) };
}

function targetForForm(index: number, form: LassoResolvedForm): ShapePoint {
  if (form === 0) {
    return polylinePoint([
      { x: 0.72, y: 0.18 }, { x: 0.62, y: 0.1 }, { x: 0.45, y: 0.11 },
      { x: 0.31, y: 0.2 }, { x: 0.27, y: 0.32 }, { x: 0.33, y: 0.39 },
      { x: 0.46, y: 0.38 }, { x: 0.57, y: 0.29 }, { x: 0.61, y: 0.15 },
      { x: 0.58, y: 0.32 }, { x: 0.52, y: 0.51 }, { x: 0.43, y: 0.7 },
      { x: 0.33, y: 0.8 }, { x: 0.24, y: 0.78 }, { x: 0.34, y: 0.7 },
      { x: 0.49, y: 0.68 }, { x: 0.65, y: 0.73 }, { x: 0.79, y: 0.68 },
      { x: 0.87, y: 0.58 },
    ], index / (LOOP_STAMPS - 1));
  }

  if (form === 1) {
    if (index < 25) return arcPoint(index / 24, 0.49, 0.48, 0.29, 0.31, -0.82, -4.65);
    if (index < 37) return polylinePoint([
      { x: 0.49, y: 0.12 }, { x: 0.46, y: 0.36 }, { x: 0.49, y: 0.73 }, { x: 0.49, y: 0.9 },
    ], (index - 25) / 11);
    if (index < 43) return polylinePoint([
      { x: 0.36, y: 0.49 }, { x: 0.36, y: 0.72 }, { x: 0.38, y: 0.88 },
    ], (index - 37) / 5);
    return polylinePoint([
      { x: 0.57, y: 0.5 }, { x: 0.57, y: 0.73 }, { x: 0.57, y: 0.88 },
    ], (index - 43) / 4);
  }

  if (form === 2) {
    if (index < 26) return arcPoint(index / 25, 0.5, 0.57, 0.28, 0.29, 0.12, -3.38);
    if (index < 42) return polylinePoint([
      { x: 0.5, y: 0.2 }, { x: 0.47, y: 0.43 }, { x: 0.5, y: 0.84 }, { x: 0.53, y: 0.43 }, { x: 0.5, y: 0.2 },
    ], (index - 26) / 15);
    return arcPoint((index - 42) / 5, 0.5, 0.1, 0.035, 0.035, 0, Math.PI * 2);
  }

  if (form === 3) {
    if (index < 25) return arcPoint(index / 24, 0.5, 0.56, 0.3, 0.26, 0.04, Math.PI - 0.08);
    return polylinePoint([
      { x: 0.2, y: 0.55 }, { x: 0.22, y: 0.33 }, { x: 0.34, y: 0.47 },
      { x: 0.29, y: 0.19 }, { x: 0.45, y: 0.4 }, { x: 0.5, y: 0.1 },
      { x: 0.55, y: 0.4 }, { x: 0.71, y: 0.19 }, { x: 0.66, y: 0.47 },
      { x: 0.78, y: 0.33 }, { x: 0.8, y: 0.55 },
    ], (index - 25) / 22);
  }

  if (index < 32) return arcPoint(index / 31, 0.48, 0.48, 0.29, 0.31, -0.72, -4.88);
  if (index < 38) return polylinePoint([
    { x: 0.47, y: 0.16 }, { x: 0.5, y: 0.06 }, { x: 0.52, y: 0.22 },
  ], (index - 32) / 5);
  if (index < 43) return polylinePoint([
    { x: 0.42, y: 0.77 }, { x: 0.46, y: 0.91 }, { x: 0.53, y: 0.78 },
  ], (index - 38) / 4);
  return arcPoint((index - 43) / 4, 0.88, 0.48, 0.035, 0.035, 0, Math.PI * 2);
}

export function resolvedFormAt(timeSeconds: number): LassoResolvedForm {
  const elapsedCycles = timeSeconds / (LOOP_CYCLE_MS / 1000);
  return ((Math.floor(elapsedCycles + 1e-9) % LOOP_SEQUENCE_LENGTH + LOOP_SEQUENCE_LENGTH) % LOOP_SEQUENCE_LENGTH) as LassoResolvedForm;
}

function lassoTarget(index: number, size: number, form: LassoResolvedForm): { x: number; y: number; z: number } {
  const target = targetForForm(index, form);
  return {
    x: target.x * size,
    y: target.y * size,
    z: target.z ?? Math.sin((Math.PI * 2 * index) / LOOP_STAMPS),
  };
}

function horizonScaleAt(phase: number): number {
  if (phase < 0.18) return 1;
  if (phase < 0.3) return mix(1, 0.1, easeBetween(phase, 0.18, 0.3));
  if (phase < 0.4) return mix(0.1, 0.52, easeBetween(phase, 0.3, 0.4));
  if (phase < 0.54) return mix(0.52, 0.86, easeBetween(phase, 0.4, 0.54));
  return 0.86;
}

function loosenessAt(phase: number): number {
  if (phase < 0.31 || phase >= 0.7) return 0;
  if (phase < 0.43) return easeBetween(phase, 0.31, 0.43);
  if (phase < 0.54) return 1;
  return 1 - easeBetween(phase, 0.54, 0.7);
}

/** The completed, still mark shown when movement has been reduced. */
export function settledLassoStamps(size: number, form: LassoResolvedForm = 0): LoopStamp[] {
  const baseRadius = stampRadiusFor(size);
  return Array.from({ length: LOOP_STAMPS }, (_, index) => {
    const target = lassoTarget(index, size, form);
    const depth = (target.z + 1) / 2;
    return {
      ...target,
      radius: baseRadius * (0.78 + 0.34 * depth),
      alpha: 0.48 + 0.52 * depth,
      cluster: index % LOOP_DOTS,
    };
  }).sort((a, b) => a.z - b.z);
}

export function loopStamps(timeSeconds: number, size: number): LoopStamp[] {
  const cycleSeconds = LOOP_CYCLE_MS / 1000;
  const elapsedCycles = timeSeconds / cycleSeconds;
  const phase = cyclePhase(elapsedCycles);
  const form = resolvedFormAt(timeSeconds);
  const superPhase = cyclePhase(elapsedCycles / LOOP_SUPER_PERIOD);
  const cohesion = cohesionAt(phase);
  const rotation = Math.PI * 2 * turnFractionAt(phase);
  const cx = size / 2;
  const cy = size / 2;
  const rx = size * LOOP_RX_RATIO;
  const baseRadius = stampRadiusFor(size);
  const radiusScale = 1 + LOOP_DOT_RADIUS_BOOST * cohesion;
  const alphaScale = 1 - LOOP_DOT_ALPHA_FADE * cohesion;
  const horizonScale = horizonScaleAt(phase);
  const looseness = loosenessAt(phase);

  return Array.from({ length: LOOP_STAMPS }, (_, index) => {
    const baseTheta = (Math.PI * 2 * index) / LOOP_STAMPS;
    const theta = baseTheta + rotation;
    const cluster = index % LOOP_DOTS;
    const clusterAngle = (Math.PI * 2 * cluster) / LOOP_DOTS + rotation;
    const angle = theta + shortestArc(theta, clusterAngle) * looseness * 0.16;
    const breath =
      0.82 +
      0.18 * Math.sin(Math.PI * 2 * superPhase + baseTheta);
    const rxAtTheta =
      rx *
      (1 +
        breath *
          (0.045 * Math.sin(3 * baseTheta) +
            0.028 * Math.sin(7 * baseTheta + 1.7) +
            0.017 * Math.sin(11 * baseTheta + 4.1)));
    const kyAtTheta =
      LOOP_KY *
      (1 +
        breath *
          (0.06 * Math.sin(2 * baseTheta + 0.9) +
            0.035 * Math.sin(5 * baseTheta + 2.6)));
    const z = Math.sin(angle);
    const depth = (z + 1) / 2;
    const grainX = grain(index, 1) - 0.5;
    const grainY = grain(index, 2) - 0.5;
    const grainAlpha = 0.92 + grain(index, 3) * 0.16;

    const driftX = size * looseness * (0.075 * Math.sin(baseTheta * 3 + superPhase * Math.PI * 2) + 0.035 * Math.sin(baseTheta * 7 + 1.9));
    const driftY = size * looseness * (0.065 * Math.cos(baseTheta * 4 - superPhase * Math.PI * 2) + 0.025 * Math.sin(baseTheta * 9 + 0.7));
    const orbit = {
      x: cx + rxAtTheta * Math.cos(angle) + driftX + grainX,
      y: cy + rxAtTheta * kyAtTheta * horizonScale * Math.sin(angle) + driftY + grainY,
    };
    const target = lassoTarget(index, size, form);
    return {
      x: mix(orbit.x, target.x, cohesion),
      y: mix(orbit.y, target.y, cohesion),
      z: mix(z, target.z, cohesion),
      radius: baseRadius * (0.72 + 0.28 * depth) * radiusScale,
      alpha: clamp((0.24 + 0.76 * depth) * alphaScale * grainAlpha, 0, 1),
      cluster,
    };
  }).sort((a, b) => a.z - b.z);
}