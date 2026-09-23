export const LOOP_STAMPS = 48;
export const LOOP_DOTS = 5;
export const LOOP_CYCLE_MS = 1800;
export const LOOP_SUPER_PERIOD = 3;

export const LOOP_RX_RATIO = 0.3;
export const LOOP_KY = 0.3;
export const LOOP_DOT_RADIUS_BOOST = 1.1;
export const LOOP_DOT_ALPHA_FADE = 0.8;

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function cyclePhase(value: number): number {
  const wrapped = ((value % 1) + 1) % 1;
  return Math.round(wrapped * 1_000_000_000_000) / 1_000_000_000_000;
}

export function cohesionAt(phase: number): number {
  const p = cyclePhase(phase);
  if (p < 0.4) return 0;
  if (p < 0.54) return easeOutCubic((p - 0.4) / 0.14);
  if (p < 0.7) return 1;
  return 1 - easeInOutCubic((p - 0.7) / 0.3);
}

export function turnFractionAt(phase: number): number {
  const p = cyclePhase(phase);
  if (p < 0.4) return 0.72 * (p / 0.4);
  if (p < 0.54) return 0.72 + 0.16 * easeOutCubic((p - 0.4) / 0.14);
  if (p < 0.7) return 0.88 + 0.02 * ((p - 0.54) / 0.16);
  return 0.9 + 0.1 * easeInOutCubic((p - 0.7) / 0.3);
}

export function stampRadiusFor(size: number): number {
  if (size <= 0) return 0.62;
  return clamp(0.0275 * size * Math.pow(36 / size, 0.35), 0.62, 1.6);
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

export function loopStamps(timeSeconds: number, size: number): LoopStamp[] {
  const cycleSeconds = LOOP_CYCLE_MS / 1000;
  const elapsedCycles = timeSeconds / cycleSeconds;
  const phase = cyclePhase(elapsedCycles);
  const superPhase = cyclePhase(elapsedCycles / LOOP_SUPER_PERIOD);
  const cohesion = cohesionAt(phase);
  const rotation = Math.PI * 2 * turnFractionAt(phase);
  const cx = size / 2;
  const cy = size / 2;
  const rx = size * LOOP_RX_RATIO;
  const baseRadius = stampRadiusFor(size);
  const radiusScale = 1 + LOOP_DOT_RADIUS_BOOST * cohesion;
  const alphaScale = 1 - LOOP_DOT_ALPHA_FADE * cohesion;

  return Array.from({ length: LOOP_STAMPS }, (_, index) => {
    const baseTheta = (Math.PI * 2 * index) / LOOP_STAMPS;
    const theta = baseTheta + rotation;
    const cluster = index % LOOP_DOTS;
    const clusterAngle = (Math.PI * 2 * cluster) / LOOP_DOTS + rotation;
    const angle = theta + shortestArc(theta, clusterAngle) * cohesion;
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

    return {
      x: cx + rxAtTheta * Math.cos(angle) + grainX,
      y: cy + rxAtTheta * kyAtTheta * Math.sin(angle) + grainY,
      z,
      radius: baseRadius * (0.72 + 0.28 * depth) * radiusScale,
      alpha: clamp((0.3 + 0.7 * depth) * alphaScale * grainAlpha, 0, 1),
      cluster,
    };
  }).sort((a, b) => a.z - b.z);
}