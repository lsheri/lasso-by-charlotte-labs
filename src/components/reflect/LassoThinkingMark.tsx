import { useEffect, useRef } from "react";

export type LassoThinkingMarkKind = "orbit" | "loop" | "gather" | "trace";

type LassoThinkingMarkProps = {
  kind: LassoThinkingMarkKind;
  size: number;
  count?: number;
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

export function LassoThinkingMark({ kind, size, count = 0, className }: LassoThinkingMarkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arrivalsRef = useRef<GatherArrival[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

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
    let startTime: number | null = null;

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

    function drawLoop(t: number) {
      for (let index = 26; index >= 0; index -= 1) {
        const age = index / 26;
        const point = ring(cx, cy, radius, t * 2 - index * 0.075);
        const depth = (point.z + 1) / 2;
        const alpha = (1 - age) * (0.22 + 0.78 * depth);
        const pointRadius = (1 + 2.6 * (1 - age)) * (0.6 + 0.4 * depth);
        dot(context, point, pointRadius, alpha);
      }
    }

    function drawGather(t: number) {
      const n = syncArrivals(t);
      if (n === 0) {
        dot(context, { x: cx, y: cy }, 2.1, 0.28);
        return;
      }
      for (const arrival of arrivalsRef.current) {
        const home = ring(cx, cy, radius, t * 1.1 + arrival.slot * ((2 * Math.PI) / n));
        const ease = 1 - Math.pow(1 - Math.min((t - arrival.born) / 0.62, 1), 3);
        const fromX = home.x + arrival.side * width * 0.42;
        const fromY = home.y + arrival.side * 9;
        const point = {
          x: fromX + (home.x - fromX) * ease,
          y: fromY + (home.y - fromY) * ease,
        };
        const depth = (home.z + 1) / 2;
        dot(context, point, (1.2 + 2.4 * depth) * ease, (0.28 + 0.72 * depth) * ease);
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
      if (startTime === null) startTime = timestamp;
      const t = (timestamp - startTime) / 1000;
      context.clearRect(0, 0, width, height);
      context.globalAlpha = 1;
      if (kind === "orbit") drawOrbit(t);
      else if (kind === "loop") drawLoop(t);
      else if (kind === "gather") drawGather(t);
      else drawTrace(t);
      context.globalAlpha = 1;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      draw(0);
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
  }, [count, kind, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={size}
      height={size}
      aria-hidden="true"
      data-lasso-thinking-mark={kind}
    />
  );
}