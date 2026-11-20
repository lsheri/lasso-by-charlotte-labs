import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";

import { easeFlow, type FirmCanvasData } from "@/lib/firm-canvas-shared";
import {
  facingAngle,
  orbModel,
  ORB_COPY,
  ORB_SPIN_PER_MS,
  project,
  pulledPlace,
  rotate,
  shortestTurn,
  type OrbModel,
  type V3,
} from "@/lib/firm-orb-shared";

export type FirmOrbHandle = {
  /** Turns the sphere to these engagements, fades the rest and pulls them into a row at the front. Resolves when done. */
  focus: (ids: string[]) => Promise<void>;
  /** Back to the slow turn. */
  reset: () => void;
};

type Colours = {
  ink: string;
  live: string;
  edge: string;
  method: string;
  ground: string;
  muted: string;
};

function readColours(element: Element): Colours {
  const style = getComputedStyle(element);
  const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    ink: get("--foreground", "black"),
    live: get("--live-edge", "green"),
    edge: get("--live-edge", "green"),
    method: get("--muted-foreground", "gray"),
    ground: get("--background", "white"),
    muted: get("--muted-foreground", "gray"),
  };
}

function tween(ms: number, step: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now: number) => {
      const t = easeFlow(Math.min(1, (now - start) / ms));
      step(t);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

/**
 * 21 Nov, D-85 PR B: the firm map as a slowly turning sphere, drawn on a canvas. Only engagements shared with the
 * firm are on it (the same server read as Firm brain), and fees show only when the server sent them (admins and
 * leads). It turns only while on screen and the tab is open; under reduced motion it holds still. Drag turns it.
 */
export const FirmOrb = forwardRef<
  FirmOrbHandle,
  { data: FirmCanvasData; reduceMotion: boolean; className?: string }
>(function FirmOrb({ data, reduceMotion, className }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({
    angle: 0.4,
    focus: 0,
    pull: 0,
    hot: [] as string[],
    spinning: true,
    dragging: null as null | { x: number; angle: number },
  });
  const keep = useRef(new Set<string>());
  const model = useMemo<OrbModel>(() => orbModel(data, keep.current), [data]);
  const modelRef = useRef(model);
  modelRef.current = model;
  const dataRef = useRef(data);
  dataRef.current = data;
  const size = useRef({ w: 0, h: 0 });
  const colours = useRef<Colours | null>(null);
  const draw = useRef<() => void>(() => {});

  draw.current = () => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const { w, h } = size.current;
    if (!w || !h) return;
    const c = (colours.current ??= readColours(el));
    const s = state.current;
    const m = modelRef.current;
    const small = w < 420;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const hotIndex = (id: string) => s.hot.indexOf(id);
    const endOf = (id: string, end: V3): V3 => {
      const turned = rotate(end, s.angle);
      const i = hotIndex(id);
      if (i < 0 || s.pull <= 0) return turned;
      const to = pulledPlace(i, s.hot.length);
      return [
        turned[0] + (to[0] - turned[0]) * s.pull,
        turned[1] + (to[1] - turned[1]) * s.pull,
        turned[2] + (to[2] - turned[2]) * s.pull,
      ];
    };
    const line = (
      points: { x: number; y: number }[],
      width: number,
      colour: string,
      alpha: number,
      dash: number[],
    ) => {
      if (alpha <= 0.01 || points.length < 2) return;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(points[0]!.x, points[0]!.y);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i]!.x, points[i]!.y);
      ctx.stroke();
    };
    for (const thread of m.threads) {
      const hot = hotIndex(thread.id) >= 0;
      let turned = thread.points.map((p) => rotate(p, s.angle));
      if (hot && s.pull > 0) {
        const end = endOf(thread.id, thread.end);
        const last = turned[turned.length - 1]!;
        const start = turned[0]!;
        const n = turned.length - 1;
        turned = turned.map((p, j) => {
          const t = j / n;
          const moved: V3 = [
            p[0] + (end[0] - last[0]) * t,
            p[1] + (end[1] - last[1]) * t,
            p[2] + (end[2] - last[2]) * t,
          ];
          const straight: V3 = [
            start[0] + (end[0] - start[0]) * t,
            start[1] + (end[1] - start[1]) * t,
            start[2] + (end[2] - start[2]) * t,
          ];
          return [
            moved[0] + (straight[0] - moved[0]) * s.pull * 0.9,
            moved[1] + (straight[1] - moved[1]) * s.pull * 0.9,
            moved[2] + (straight[2] - moved[2]) * s.pull * 0.9,
          ];
        });
      }
      const points = turned.map((p) => project(p, w, h));
      if (!hot || s.focus === 0) {
        line(points, 2.2, c.edge, 0.12 * (1 - 0.9 * s.focus), [7, 6]);
        line(points, 1.3, c.live, 0.5 * (1 - 0.88 * s.focus), [7, 6]);
      } else {
        line(points, 4.6, c.edge, 0.35 * s.focus, []);
        line(points, 2.6, c.live, s.focus, []);
      }
    }
    ctx.setLineDash([]);
    type Dot = { r: V3; size: number; colour: string; hot: boolean };
    const dots: Dot[] = [
      ...m.situations.map((n) => ({ r: rotate(n.p, s.angle), size: 7, colour: c.ink, hot: false })),
      ...m.methods.map((n) => ({
        r: rotate(n.p, s.angle),
        size: 4.5,
        colour: c.method,
        hot: false,
      })),
      ...m.threads.map((t) => ({
        r: endOf(t.id, t.end),
        size: hotIndex(t.id) >= 0 ? 5.2 : 3.6,
        colour: c.ink,
        hot: hotIndex(t.id) >= 0,
      })),
    ].sort((a, b) => a.r[2] - b.r[2]);
    for (const dot of dots) {
      const q = project(dot.r, w, h);
      const depth = 0.5 + 0.5 * ((q.z + 1.2) / 2.4);
      const radius = dot.size * q.k * (small ? 0.85 : 1);
      if (dot.hot && s.focus > 0) {
        ctx.globalAlpha = 0.22 * s.focus;
        ctx.fillStyle = c.live;
        ctx.beginPath();
        ctx.arc(q.x, q.y, radius * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = (dot.hot ? 1 : 1 - 0.82 * s.focus) * depth;
      ctx.fillStyle = dot.colour;
      ctx.beginPath();
      ctx.arc(q.x, q.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    // A label never runs off the canvas: its middle is kept half its width in from each side.
    const inside = (text: string, x: number) => {
      const half = ctx.measureText(text).width / 2 + 4;
      return Math.max(half, Math.min(w - half, x));
    };
    ctx.strokeStyle = c.ground;
    if (s.focus < 0.6) {
      ctx.font = `600 ${small ? 11 : 12}px Archivo, system-ui, sans-serif`;
      ctx.fillStyle = c.muted;
      for (const node of m.situations) {
        const q = project(rotate(node.p, s.angle), w, h);
        const alpha = (1 - s.focus / 0.6) * Math.max(0, Math.min(1, (q.z - 0.15) * 2.4));
        if (alpha < 0.04) continue;
        ctx.globalAlpha = alpha;
        const x = inside(node.label, q.x);
        ctx.strokeText(node.label, x, q.y + 16);
        ctx.fillText(node.label, x, q.y + 16);
      }
    }
    if (s.focus > 0 && s.pull > 0.3) {
      const alpha = Math.min(1, (s.pull - 0.3) / 0.5);
      m.threads
        .filter((t) => hotIndex(t.id) >= 0)
        .forEach((t, i) => {
          const q = project(endOf(t.id, t.end), w, h);
          const y = q.y + (i % 2 ? 24 : -16);
          ctx.globalAlpha = alpha;
          ctx.font = `600 ${small ? 11.5 : 13}px Archivo, system-ui, sans-serif`;
          ctx.fillStyle = c.ink;
          const x = inside(t.name, q.x);
          ctx.strokeText(t.name, x, y);
          ctx.fillText(t.name, x, y);
          if (t.fee) {
            const fy = y + (i % 2 ? 15 : -15);
            ctx.font = `500 ${small ? 10.5 : 11.5}px "JetBrains Mono", ui-monospace, monospace`;
            ctx.fillStyle = c.muted;
            const fx = inside(t.fee, q.x);
            ctx.strokeText(t.fee, fx, fy);
            ctx.fillText(t.fee, fx, fy);
          }
        });
    }
    ctx.globalAlpha = 1;
  };

  // Size to the element, sharp on high-density screens; redraw on resize and on a theme change.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: r.width, h: r.height };
      el.width = Math.round(r.width * dpr);
      el.height = Math.round(r.height * dpr);
      el.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      colours.current = null;
      draw.current();
    };
    fit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    draw.current();
  }, [model]);

  // The slow turn: only while the sphere is on screen and the tab is visible, never under reduced motion.
  useEffect(() => {
    const el = canvas.current;
    if (!el || reduceMotion) {
      draw.current();
      return;
    }
    let raf = 0;
    let last = 0;
    let onScreen = true;
    const loop = (now: number) => {
      raf = 0;
      if (!onScreen || document.hidden) return;
      const dt = Math.min(50, now - (last || now));
      last = now;
      const s = state.current;
      if (s.spinning && !s.dragging) s.angle += dt * ORB_SPIN_PER_MS;
      draw.current();
      raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!raf && onScreen && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            onScreen = entries.some((entry) => entry.isIntersecting);
            kick();
          });
    io?.observe(el);
    document.addEventListener("visibilitychange", kick);
    kick();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
      document.removeEventListener("visibilitychange", kick);
    };
  }, [reduceMotion]);

  // Drag turns it.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const down = (event: PointerEvent) => {
      state.current.dragging = { x: event.clientX, angle: state.current.angle };
      el.setPointerCapture?.(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const drag = state.current.dragging;
      if (!drag) return;
      state.current.angle = drag.angle + (event.clientX - drag.x) * 0.008;
      if (reduceMotion) draw.current();
    };
    const up = () => {
      state.current.dragging = null;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [reduceMotion]);

  useImperativeHandle(
    ref,
    () => ({
      async focus(ids: string[]) {
        const s = state.current;
        ids.forEach((id) => keep.current.add(id));
        // A quoted engagement left out by the cap is added before the turn.
        if (ids.some((id) => !modelRef.current.threads.some((t) => t.id === id)))
          modelRef.current = orbModel(dataRef.current, keep.current);
        const present = ids.filter((id) => modelRef.current.threads.some((t) => t.id === id));
        s.hot = present;
        s.spinning = false;
        const target = facingAngle(modelRef.current, present);
        const from = s.angle;
        const turn = target === null ? 0 : shortestTurn(from, target);
        if (reduceMotion) {
          s.angle = from + turn;
          s.focus = 1;
          s.pull = 1;
          draw.current();
          return;
        }
        await tween(1200, (t) => {
          s.angle = from + turn * t;
          s.focus = t;
          draw.current();
        });
        if (present.length) {
          await tween(1000, (t) => {
            s.pull = t;
            draw.current();
          });
        }
      },
      reset() {
        const s = state.current;
        s.hot = [];
        s.focus = 0;
        s.pull = 0;
        s.spinning = true;
        draw.current();
      },
    }),
    [reduceMotion],
  );

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={ORB_COPY.label}
      data-testid="firm-orb"
      className={className ?? "block h-[300px] w-full cursor-grab touch-pan-y max-md:h-[240px]"}
    />
  );
});
