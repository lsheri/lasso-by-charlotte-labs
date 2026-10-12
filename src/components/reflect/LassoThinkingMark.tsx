import { useEffect, useRef } from "react";

import {
  LOOP_CYCLE_MS,
  cohesionAt,
  loopStamps,
  resolvedFormAt,
  resolvedLinework,
  scatterAngLerp,
  scatterGeometry,
  scatterLerp,
  scatterLoopPoint,
  scatterPhase,
  scatterPieces,
  scatterSmooth,
  scatterStroke,
  SCATTER_ROPE_ANGLE,
  SCATTER_ROPE_LENGTH,
  type LoopStamp,
} from "@/lib/lasso-loop";

export type LassoThinkingMarkKind = "orbit" | "loop" | "gather" | "trace" | "signature";

type LassoThinkingMarkProps = {
  kind: LassoThinkingMarkKind;
  size: number;
  count?: number;
  /** signature only: lime working state; false is the calm, graphite answered state. */
  thinking?: boolean;
  rope?: boolean;
  className?: string;
};

type RingPoint = { x: number; y: number; z: number };
type GatherArrival = { born: number; slot: number; side: -1 | 1 };

const TILT = 0.18;

function ring(cx: number, cy: number, radius: number, phase: number): RingPoint {
  return {
    x: cx + radius * Math.cos(phase),
    y: cy + radius * TILT * Math.sin(phase),
    z: Math.sin(phase),
  };
}

function dot(
  context: CanvasRenderingContext2D,
  point: { x: number; y: number },
  radius: number,
  alpha: number,
) {
  context.globalAlpha = alpha;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
}

function particle(context: CanvasRenderingContext2D, stamp: LoopStamp, halo = true) {
  if (halo && stamp.radius > 0.9) {
    dot(context, stamp, stamp.radius * 2.25, stamp.alpha * 0.1);
  }
  dot(context, stamp, stamp.radius, stamp.alpha);
}

function drawResolvedMark(context: CanvasRenderingContext2D, time: number, size: number, alpha: number) {
  if (alpha <= 0) return;
  context.save();
  context.globalAlpha = alpha;
  context.lineWidth = Math.max(1.35, size * 0.034);
  context.lineJoin = "round";
  for (const path of resolvedLinework(size, resolvedFormAt(time))) {
    const first = path.points[0];
    if (!first) continue;
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (const point of path.points.slice(1)) context.lineTo(point.x, point.y);
    if (path.closed) context.closePath();
    context.stroke();
  }
  context.restore();
}

/** TM-1 scatter to lasso. One rAF loop, paused drawing off screen, nothing scheduled under reduced motion. */
function runSignature(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  size: number,
  thinkingRef: { current: boolean },
  ropeRef: { current: boolean },
): () => void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const styles = window.getComputedStyle(canvas);
  const acc = styles.getPropertyValue("--nb-lasso-green").trim();
  const ink = styles.getPropertyValue("--nb-ink").trim();
  const rest = styles.getPropertyValue("--nb-graphite").trim();
  const els = scatterPieces(size);
  const { w, dot: dotSize, unit } = scatterStroke(size);
  const { cx, cy, R } = scatterGeometry(size);

  function draw(t: number, forceCinch: boolean) {
    const ph = scatterPhase(t, thinkingRef.current, forceCinch);
    const { think, k, p, strokeA, q, cinch, partA, omega, wobble } = ph;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size, size);
    const col0 = think ? ink : rest;
    const hot = think ? acc : rest;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (let i = 0; i < els.length; i += 1) {
      const e = els[i]!;
      const swirl = omega * t * e.sp * (1 + 0.7 * (1 - e.r));
      const th = e.a0 + swirl + wobble * 0.18 * Math.sin(t * 1.3 + e.ph);
      const rr = e.r + wobble * (0.1 * Math.sin(t * 1.7 + e.ph) + 0.06 * Math.sin(t * 2.9 + 2 * e.ph));
      const sx = cx + Math.cos(th) * R * rr * 1.08;
      const sy = cy + Math.sin(th) * R * rr * 1.08;
      const breath = Math.pow(0.5 + 0.5 * Math.sin(t * 1.25 * e.sp + e.ph * 3), 2);
      const slen = R * 0.36 * breath;
      const sdir = th + Math.PI / 2 + 1.1 * Math.sin(t * 0.8 + e.ph) * wobble;
      const lp = scatterLoopPoint((i + 0.5) / els.length, R, cx, cy, cinch);
      const llen = ((Math.PI * 2 * R) / els.length) * 0.62;
      const kk = scatterSmooth(k * 1.25 - (i / els.length) * 0.25);
      const x = scatterLerp(sx, lp.x, kk);
      const y = scatterLerp(sy, lp.y, kk);
      const len = scatterLerp(slen, llen, kk);
      const dir = scatterAngLerp(sdir, lp.a + Math.PI / 2, kk);
      const a = partA * (forceCinch ? 0 : scatterLerp(0.55 + 0.45 * (1 - e.r * 0.5), 1, kk));
      if (a <= 0.01) continue;
      context.globalAlpha = a;
      const col = think && (e.lime || kk > 0.92) ? hot : col0;
      if (len < dotSize * 1.6) {
        context.fillStyle = col;
        context.beginPath();
        context.arc(x, y, dotSize * (1 - 0.3 * breath * (1 - kk)), 0, Math.PI * 2);
        context.fill();
      } else {
        const dx = (Math.cos(dir) * len) / 2;
        const dy = (Math.sin(dir) * len) / 2;
        context.strokeStyle = col;
        context.lineWidth = w;
        context.beginPath();
        context.moveTo(x - dx, y - dy);
        context.lineTo(x + dx, y + dy);
        context.stroke();
      }
    }
    if (p > 0.001 && strokeA > 0.01) {
      context.globalAlpha = strokeA;
      if (ph.glow > 0.02) {
        context.shadowColor = acc;
        context.shadowBlur = Math.max(2, 7 * unit) * ph.glow;
      }
      context.strokeStyle = hot;
      context.lineWidth = w * 1.25;
      context.beginPath();
      const steps = Math.max(40, Math.round(size * 1.2));
      for (let j = 0; j <= steps; j += 1) {
        const pt = scatterLoopPoint((p * j) / steps, R, cx, cy, cinch);
        if (j === 0) context.moveTo(pt.x, pt.y);
        else context.lineTo(pt.x, pt.y);
      }
      context.stroke();
      if (ropeRef.current && q > 0.001) {
        const ep = scatterLoopPoint(1, R, cx, cy, cinch);
        const L = R * SCATTER_ROPE_LENGTH * q;
        context.beginPath();
        context.moveTo(ep.x, ep.y);
        context.lineTo(ep.x + Math.cos(SCATTER_ROPE_ANGLE) * L, ep.y + Math.sin(SCATTER_ROPE_ANGLE) * L);
        context.stroke();
      }
      context.shadowBlur = 0;
    }
    context.globalAlpha = 1;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    draw(0, true);
    return () => {};
  }

  let visible = true;
  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== "undefined") {
    observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
    });
    observer.observe(canvas);
  }
  let clock = 0;
  let last = performance.now();
  let frameId: number | null = null;
  const frame = (now: number) => {
    const dt = Math.min(64, now - last);
    last = now;
    if (visible) {
      clock += dt / 1000;
      draw(clock, false);
    }
    frameId = window.requestAnimationFrame(frame);
  };
  frameId = window.requestAnimationFrame(frame);
  return () => {
    observer?.disconnect();
    if (frameId !== null) window.cancelAnimationFrame(frameId);
  };
}

export function LassoThinkingMark({ kind, size, count = 0, thinking = false, rope = true, className }: LassoThinkingMarkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thinkingRef = useRef(thinking);
  thinkingRef.current = thinking;
  const ropeRef = useRef(rope);
  ropeRef.current = rope;
  const arrivalsRef = useRef<GatherArrival[]>([]);
  const clockBaseRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const foundContext = canvas.getContext("2d");
    if (!foundContext) return;
    const context: CanvasRenderingContext2D = foundContext;
    if (kind === "signature") return runSignature(canvas, context, size, thinkingRef, ropeRef);

    const width = size;
    const height = size;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const lime = window.getComputedStyle(canvas).getPropertyValue("--nb-lasso-green").trim();
    context.fillStyle = lime;
    context.strokeStyle = lime;
    context.lineCap = "round";

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width * 0.22, 34);
    let frameId: number | null = null;
    let visible = typeof IntersectionObserver === "undefined";
    const mountedAt = performance.now();
    if (clockBaseRef.current === null) clockBaseRef.current = mountedAt;
    const clockBase = clockBaseRef.current;

    function syncArrivals(t: number) {
      const n = Math.max(0, Math.floor(count));
      if (arrivalsRef.current.length > n) arrivalsRef.current = arrivalsRef.current.slice(0, n);
      while (arrivalsRef.current.length < n) {
        const slot = arrivalsRef.current.length;
        arrivalsRef.current.push({ born: t, slot, side: slot % 2 ? -1 : 1 });
      }
      return n;
    }

    function drawOrbit(t: number) {
      const points = Array.from({ length: 5 }, (_, index) => {
        const point = ring(cx, cy, radius, t * 1.5 + index * ((2 * Math.PI) / 5));
        return { ...point, depth: (point.z + 1) / 2 };
      }).sort((a, b) => a.z - b.z);
      for (const point of points) {
        dot(context, point, 2.1 + 2 * point.depth, 0.3 + 0.7 * point.depth);
      }
    }

    function drawResolvingLoop(t: number, opacity = 1) {
      const resolved = cohesionAt(t / (LOOP_CYCLE_MS / 1000));
      for (const stamp of loopStamps(t, size)) {
        particle(context, { ...stamp, alpha: stamp.alpha * opacity * (1 - resolved) });
      }
      drawResolvedMark(context, t, size, resolved * opacity);
    }

    function drawGather(t: number) {
      const n = syncArrivals(t);
      drawResolvingLoop(t, 0.72);
      for (const arrival of arrivalsRef.current) {
        const home = ring(cx, cy, radius, t * 1.1 + arrival.slot * ((2 * Math.PI) / n));
        const progress = Math.max(0, Math.min((t - arrival.born) / 0.62, 1));
        const ease = 1 - Math.pow(1 - progress, 3);
        const fromX = home.x + arrival.side * width * 0.42;
        const fromY = home.y + arrival.side * 9;
        const point = {
          x: fromX + (home.x - fromX) * ease,
          y: fromY + (home.y - fromY) * ease,
        };
        const depth = (home.z + 1) / 2;
        particle(context, {
          ...point,
          z: home.z,
          radius: (1.2 + 2.4 * depth) * ease,
          alpha: (0.28 + 0.72 * depth) * ease,
          cluster: arrival.slot % 5,
        });
      }
    }

    function drawTrace(t: number) {
      const axisX = Math.min(width * 0.3, 46);
      const axisY = Math.min(height * 0.28, 15);
      for (let index = 60; index >= 1; index -= 1) {
        const age = index / 60;
        const s = t * 1.35 - index * 0.026;
        const previous = t * 1.35 - (index - 1) * 0.026;
        context.globalAlpha = (1 - age) * 0.9;
        context.lineWidth = 0.6 + 2.6 * (1 - age);
        context.beginPath();
        context.moveTo(cx + axisX * Math.sin(s), cy + axisY * Math.sin(2 * s));
        context.lineTo(cx + axisX * Math.sin(previous), cy + axisY * Math.sin(2 * previous));
        context.stroke();
      }
    }

    function draw(timestamp: number) {
      const t = (timestamp - clockBase) / 1000;
      context.clearRect(0, 0, width, height);
      context.globalAlpha = 1;
      if (kind === "orbit") drawOrbit(t);
      else if (kind === "loop") drawResolvingLoop(t);
      else if (kind === "gather") drawGather(t);
      else drawTrace(t);
      context.globalAlpha = 1;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      context.clearRect(0, 0, width, height);
      drawResolvedMark(context, 0, size, 1);
      context.globalAlpha = 1;
      return;
    }

    const animate = (timestamp: number) => {
      draw(timestamp);
      if (visible) frameId = window.requestAnimationFrame(animate);
    };
    const start = () => {
      if (!visible || frameId !== null) return;
      frameId = window.requestAnimationFrame(animate);
    };
    const stop = () => {
      if (frameId === null) return;
      window.cancelAnimationFrame(frameId);
      frameId = null;
    };

    let observer: IntersectionObserver | null = null;
    draw(mountedAt);
    if (typeof IntersectionObserver === "undefined") {
      start();
    } else {
      observer = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? false;
        if (visible) start();
        else stop();
      });
      observer.observe(canvas);
    }

    return () => {
      observer?.disconnect();
      stop();
    };
  }, [count, kind, size, rope]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={size}
      height={size}
      aria-hidden="true"
      data-lasso-thinking-mark={kind}
      data-thinking={kind === "signature" ? (thinking ? "true" : "false") : undefined}
      data-rope={rope ? "true" : "false"}
    />
  );
}