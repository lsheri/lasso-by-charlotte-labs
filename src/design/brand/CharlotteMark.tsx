/* The Charlotte mark: the still Monoline C, and the growing web while Lasso is reading.
   One requestAnimationFrame loop writes SVG attributes directly; React does not re-render per frame.
   The loop runs only while reading and on screen. Reduced motion shows the finished web, still.
   Storybook only until PR6 gives LassoThinkingMark a Charlotte branch. */
import { type CSSProperties, useEffect, useRef, useState } from "react";

import "./charlotte-mark.css";
import {
  CYCLE_S,
  MONO_ARC,
  MONO_SPOKES,
  type MarkFrame,
  type MarkWeight,
  cycleAt,
  growFrame,
  webVars,
  wmVars,
} from "./charlotte-mark";

export type MarkState = "idle" | "reading" | "live";

const NODE_SLOTS = 8;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function CharlotteMark({
  state = "idle",
  size = 32,
  weight = "thin",
  progress,
  reducedMotion,
}: {
  state?: MarkState;
  size?: number;
  weight?: MarkWeight;
  /** Pin the web to one point of its growth (0 to 1) instead of running the loop. For scrubbing. */
  progress?: number | undefined;
  /** Override the system setting; stories use it to show the reduced-motion form. */
  reducedMotion?: boolean | undefined;
}) {
  const [systemReduced] = useState(prefersReducedMotion);
  const reduced = reducedMotion ?? systemReduced;

  // What to draw before (or instead of) the loop.
  const grown = state === "reading" || progress !== undefined;
  const pinned = progress !== undefined ? progress : reduced ? 1 : 0;
  const frame: MarkFrame | null = grown ? growFrame(pinned, size) : null;
  const cls = !frame ? state : frame.done ? "live" : "reading";
  const running = state === "reading" && progress === undefined && !reduced;
  // The web has its own, thinner small weights; the still C keeps the spec's.
  const v = frame ? webVars(size, weight) : wmVars(size, weight);

  const svg = useRef<SVGSVGElement>(null);
  const spokes = useRef<SVGPathElement>(null);
  const arc = useRef<SVGPathElement>(null);
  const rings = useRef<(SVGPathElement | null)[]>([]);
  const nodes = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    if (!running || !svg.current) return;
    const el = svg.current;
    let raf = 0;
    let visible = true;
    let elapsed = 0;
    let last = performance.now();

    const draw = (f: MarkFrame, opacity: number) => {
      el.setAttribute("class", `wm ${f.done ? "live" : "reading"}`);
      el.style.opacity = String(opacity);
      spokes.current?.setAttribute("d", f.spokes);
      arc.current?.setAttribute("d", f.arc);
      f.rings.forEach((ring, i) => {
        const path = rings.current[i];
        if (!path) return;
        path.style.display = ring.visible ? "" : "none";
        path.style.strokeDashoffset = String(ring.offset);
      });
      for (let i = 0; i < NODE_SLOTS; i++) {
        const node = nodes.current[i];
        const n = f.nodes[i];
        if (!node) continue;
        node.setAttribute("r", n ? String(n.r) : "0");
        if (n) {
          node.setAttribute("cx", String(n.cx));
          node.setAttribute("cy", String(n.cy));
        }
      }
    };

    const tick = (now: number) => {
      elapsed = (elapsed + (now - last) / 1000) % CYCLE_S;
      last = now;
      const { p, opacity } = cycleAt(elapsed);
      draw(growFrame(p, size), opacity);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
            if (visible) start();
            else stop();
          });
    io?.observe(el);
    if (visible) start();
    return () => {
      io?.disconnect();
      stop();
    };
  }, [running, size]);

  const style = { "--k": v.k, "--sw": v.sw, "--ws": v.ws } as CSSProperties;
  return (
    <svg
      // Remount per mode, so attributes the loop wrote never outlive it.
      key={`${cls}-${running}-${size}`}
      ref={svg}
      className={`wm ${cls}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={style}
      data-charlotte-mark={state}
      data-size={size}
    >
      <path ref={spokes} className="st" d={frame ? frame.spokes : MONO_SPOKES} />
      {(frame?.rings ?? []).map((ring, i) => (
        <path
          key={i}
          ref={(node) => {
            rings.current[i] = node;
          }}
          className="st"
          pathLength={1}
          d={ring.d}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: ring.offset,
            display: ring.visible ? undefined : "none",
          }}
        />
      ))}
      <path ref={arc} className="ln" d={frame ? frame.arc : MONO_ARC} />
      {frame && !v.small
        ? Array.from({ length: NODE_SLOTS }, (_, i) => {
            const n = frame.nodes[i];
            return (
              <circle
                key={i}
                ref={(node) => {
                  nodes.current[i] = node;
                }}
                className="nd"
                cx={n?.cx ?? 32}
                cy={n?.cy ?? 32}
                r={n?.r ?? 0}
              />
            );
          })
        : null}
      <circle className="lv" cx="32" cy="32" r={v.hub} />
    </svg>
  );
}
