/**
 * Graphite marks (pass 88). Three hand-drawn strokes, and only these three.
 *
 * A mark is presentation beside a human action that already happened: the
 * CHECK when something is confirmed or accepted, the ELLIPSE when a share is
 * confirmed, the STRIKE when something is discarded. Marks never delay, block
 * or reorder a write, carry no telemetry, and are aria-hidden.
 *
 * One per viewport: a mark that starts while another started less than 400ms
 * ago renders nothing at all, statically.
 */
import { useCallback, useMemo, useRef, useState } from "react";

import { HATCH_BOX, fnv1a, hatchStrokes, mulberry32, wavingSwatchD } from "@/lib/journey-path";

const MARK_WINDOW_MS = 400;

let lastMarkAt = -Infinity;

/** The one-per-viewport gate. Returns false when another mark just started. */
export function claimMark(now: number = Date.now()): boolean {
  if (now - lastMarkAt < MARK_WINDOW_MS) return false;
  lastMarkAt = now;
  return true;
}

/** Test seam: forget the last claim. */
export function resetMarkGate(): void {
  lastMarkAt = -Infinity;
}

/**
 * Fire-and-forget trigger for a mark. `fire(id)` shows the mark and records
 * which element was acted on; list sites render the mark only where
 * `markId === theirId`. It clears itself once the stroke has landed.
 */
export function useMark(hold = 900): {
  shown: boolean;
  markId: string | null;
  markKey: number;
  fire: (id?: string) => void;
} {
  const [state, setState] = useState<{ shown: boolean; id: string | null; key: number }>({
    shown: false,
    id: null,
    key: 0,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fire = useCallback(
    (id?: string) => {
      setState((prev) => ({ shown: true, id: id ?? null, key: prev.key + 1 }));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(
        () => setState((prev) => ({ ...prev, shown: false, id: null })),
        hold,
      );
    },
    [hold],
  );

  return { shown: state.shown, markId: state.id, markKey: state.key, fire };
}


function useClaim(): boolean {
  const [claimed] = useState(() => claimMark(Date.now()));
  return claimed;
}

/** Confirmed, accepted. Drawn beside the thing that was decided. */
export function DrawnCheck({ size = 18, className = "" }: { size?: number; className?: string }) {
  if (!useClaim()) return null;
  return (
    <svg
      className={`nb-mark pointer-events-none ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="var(--nb-graphite)"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path pathLength={1} d="M3 11.4c1.7.7 3.1 2 4.2 3.6C9.4 10.6 12.4 6.9 17 4.2" />
    </svg>
  );
}

/** Shared. Circled the thing that is now visible to someone else. */
export function DrawnEllipse({ className = "" }: { className?: string }) {
  if (!useClaim()) return null;
  return (
    <svg
      className={`nb-mark pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox="0 0 200 44"
      preserveAspectRatio="none"
      fill="none"
      stroke="var(--nb-graphite)"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      aria-hidden
    >
      <path
        pathLength={1}
        vectorEffect="non-scaling-stroke"
        d="M100 4C148 3.4 195 10 195 22.6c0 12.4-46 18.6-95 18.6C52 41.2 5 35.4 5 22.4 5 10.2 50 4.6 100 4c14-.2 28 .6 41 2.6"
      />
    </svg>
  );
}

/** Discarded. One quick pen line through the label. */
export function DrawnStrike({ className = "" }: { className?: string }) {
  if (!useClaim()) return null;
  return (
    <svg
      className={`nb-mark pointer-events-none absolute inset-x-0 top-1/2 h-3 w-full -translate-y-1/2 ${className}`}
      viewBox="0 0 120 12"
      preserveAspectRatio="none"
      fill="none"
      stroke="var(--nb-graphite)"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      aria-hidden
    >
      <path
        pathLength={1}
        vectorEffect="non-scaling-stroke"
        d="M4 7C24 5.4 44 8.2 64 6.6c18-1.4 36 .6 52-1.2"
      />
    </svg>
  );
}

/**
 * The journey stem: a graphite line that grows down the page between nodes.
 * Hand-drawn strokes live only in this module, so the stem is here rather than
 * in the journey view. Static art with an optional draw, no claim on the
 * one-per-viewport gate.
 */
export function JourneyStem({
  className = "",
  drawing = false,
  delayMs = 0,
}: {
  className?: string;
  drawing?: boolean;
  delayMs?: number;
}) {
  return (
    <svg
      className={`nb-journey-stem pointer-events-none ${drawing ? "" : "nb-journey-stem-static"} ${className}`}
      viewBox="0 0 6 100"
      preserveAspectRatio="none"
      fill="none"
      stroke="var(--nb-graphite)"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={drawing ? { animationDelay: `${delayMs}ms` } : undefined}
      aria-hidden
    >
      <path
        pathLength={1}
        d="M3 0.5C2.1 12 3.8 24 2.9 36c-.8 11 1.4 22 .4 33 -.7 8 .5 17 -.1 30.5"
        strokeWidth={1.4}
      />
      <path
        pathLength={1}
        d="M3.5 2C4.2 18 2.6 34 3.4 50c.7 15 -.6 31 .2 48"
        strokeWidth={0.6}
        opacity={0.45}
      />
    </svg>
  );
}

/**
 * A stitch moment on the stem: the same yellow loop language the lasso speaks,
 * drawn small beside the conversation the question was asked of.
 */
export function StitchLoop({
  size = 22,
  className = "",
  drawing = false,
  delayMs = 0,
}: {
  size?: number;
  className?: string;
  drawing?: boolean;
  delayMs?: number;
}) {
  return (
    <svg
      className={`nb-journey-loop ${drawing ? "" : "nb-journey-loop-static"} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--nb-ink-yellow)"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={drawing ? { animationDelay: `${delayMs}ms` } : undefined}
      aria-hidden
    >
      <path
        pathLength={1}
        d="M15 5.6C9.6 3.4 3.6 6 3.2 11.4c-.4 5.2 5.4 8.6 10.4 7.8 4.6-.7 8-4.6 6.6-8.3-1-2.6-4.2-4-7-3.4"
      />
    </svg>
  );
}

/**
 * The chalice. A grail drawn in the same hand as everything else: wide shallow
 * cup, sturdy stem, broad base, two small handles. It leads the Work Artifact,
 * the one card that teaches how a piece of work was actually made.
 */
export function ChaliceMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`pointer-events-none shrink-0 ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--nb-ink-yellow)"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* the cup */}
      <path d="M5.4 4.3c4.3-.5 8.9-.6 13.2-.1-.2 3.9-2.6 6.9-6.5 7-3.9.1-6.4-2.9-6.7-6.9" />
      {/* the stem */}
      <path d="M12.1 11.2c.2 2.3-.1 4.5.1 6.8" />
      {/* the base */}
      <path d="M7.9 19.8c2.7-.6 5.6-.7 8.4-.1" />
      <path d="M8.6 18.4c2.3-.5 4.7-.5 7 .1" />
      {/* the handles */}
      <path d="M5.6 5.2c-1.5.4-2.2 1.9-1.3 3.1.6.8 1.7 1.1 2.6.9" />
      <path d="M18.5 5.2c1.5.3 2.3 1.8 1.4 3-.6.9-1.7 1.2-2.6 1" />
    </svg>
  );
}

/**
 * A ruled line under a page title, drawn by hand rather than by a border.
 * Static art: no claim on the one-per-viewport gate, no motion. It stretches
 * to whatever width the title occupies.
 */
export function GraphiteRule({ className = "" }: { className?: string }) {

  return (
    <svg
      className={`nb-title-rule pointer-events-none ${className}`}
      viewBox="0 0 300 6"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path
        d="M1 3.4C38 2.2 74 4.2 111 3.1c36-1 72 1.4 108 .5 27-.7 54 1.1 80 .6"
        strokeWidth={1.5}
      />
      <path
        d="M1 4.2C44 3.4 88 4.8 132 4.1c40-.6 80 .9 120 .3"
        strokeWidth={0.7}
        opacity={0.55}
      />
    </svg>
  );
}

/**
 * Pass 114: the pencil firework. A small burst beside a tool's logo when its
 * work arrives on the path: a storyteller's beat, never a notification. It is
 * transient by design, so its resting state is invisible.
 */
const FIREWORK_ANGLES = [-80, -45, -10, 25, 115, 160, 205];

export type FireworkStroke = { d: string; ink: "yellow" | "graphite" };

/** Deterministic burst geometry for one node, keyed on its id. */
export function fireworkStrokes(key: string): {
  strokes: FireworkStroke[];
  dots: { x: number; y: number }[];
} {
  const seed = fnv1a(key);
  const rand = (k: number) => mulberry32((seed + Math.imul(k + 1, 0x9e3779b1)) >>> 0)();
  const round = (value: number) => Math.round(value * 100) / 100;
  const origin = { x: 24, y: 24 };

  const strokes = FIREWORK_ANGLES.map((degrees, k) => {
    const angle = (degrees * Math.PI) / 180;
    const length = 8 + rand(k * 7) * 6;
    const start = {
      x: origin.x + Math.cos(angle) * 5,
      y: origin.y + Math.sin(angle) * 5,
    };
    const end = {
      x: origin.x + Math.cos(angle) * (5 + length),
      y: origin.y + Math.sin(angle) * (5 + length),
    };
    const wobble = (rand(k * 7 + 3) * 2 - 1) * 1.2;
    const mid = {
      x: (start.x + end.x) / 2 - Math.sin(angle) * wobble,
      y: (start.y + end.y) / 2 + Math.cos(angle) * wobble,
    };
    return {
      d: `M ${round(start.x)} ${round(start.y)} Q ${round(mid.x)} ${round(mid.y)} ${round(end.x)} ${round(end.y)}`,
      ink: (k % 2 === 0 ? "yellow" : "graphite") as FireworkStroke["ink"],
    };
  });

  const dots = [0, 1].map((k) => {
    const between = k === 0 ? 1 : 4;
    const a = FIREWORK_ANGLES[between] as number;
    const b = FIREWORK_ANGLES[between + 1] as number;
    const angle = (((a + b) / 2) * Math.PI) / 180;
    const radius = 16 + rand(k * 13 + 5) * 2;
    return { x: round(origin.x + Math.cos(angle) * radius), y: round(origin.y + Math.sin(angle) * radius) };
  });

  return { strokes, dots };
}

/** The burst itself. Base state is invisible: a finished path holds no fireworks. */
export function PencilFirework({
  nodeId,
  delayMs = 0,
  drawing = false,
  className = "",
}: {
  nodeId: string;
  delayMs?: number;
  drawing?: boolean;
  className?: string;
}) {
  const { strokes, dots } = fireworkStrokes(nodeId);
  return (
    <svg
      className={`nb-firework pointer-events-none ${className}`}
      width={48}
      height={48}
      viewBox="0 0 48 48"
      fill="none"
      data-testid="journey-firework"
      style={drawing ? { animationDelay: `${delayMs}ms` } : undefined}
      aria-hidden
    >
      {strokes.map((stroke, k) => (
        <path
          key={`s${k}`}
          className="nb-firework-stroke"
          d={stroke.d}
          stroke={stroke.ink === "yellow" ? "var(--nb-ink-yellow)" : "var(--nb-graphite)"}
          strokeWidth={1.5}
          strokeLinecap="round"
          style={drawing ? { animationDelay: `${delayMs + k * 35}ms` } : undefined}
        />
      ))}
      {dots.map((dot, k) => (
        <circle key={`d${k}`} cx={dot.x} cy={dot.y} r={1.5} fill="var(--nb-ink-yellow)" />
      ))}
    </svg>
  );
}

/**
 * Pass 115: the pencil hatching that stands behind a call to action. Seeded
 * once per literal seed, so the two heroes are drawn differently but always
 * the same way, and never from Math.random.
 */
export function PencilHatch({ seed, className = "" }: { seed: string; className?: string }) {
  const strokes = useMemo(() => hatchStrokes(seed), [seed]);
  return (
    <svg
      className={`nb-hatch ${className}`}
      viewBox={`0 0 ${HATCH_BOX.width} ${HATCH_BOX.height}`}
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
      data-testid={`pencil-hatch-${seed}`}
      data-strokes={strokes.length}
    >
      {strokes.map((stroke, k) => (
        <line
          key={k}
          x1={stroke.x1}
          y1={stroke.y1}
          x2={stroke.x2}
          y2={stroke.y2}
          stroke="var(--nb-rule)"
          strokeWidth={1}
          opacity={stroke.opacity}
        />
      ))}
    </svg>
  );
}

/** The small wavering swatch of yellow thread that opens the traced legend. */
export function TracedSwatch({ seed = "legend" }: { seed?: string }) {
  const d = useMemo(() => wavingSwatchD(seed), [seed]);
  return (
    <svg
      className="shrink-0"
      width={28}
      height={10}
      viewBox="0 0 28 10"
      fill="none"
      aria-hidden
      data-testid="traced-legend-swatch"
    >
      <path d={d} stroke="var(--nb-ink-yellow)" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
