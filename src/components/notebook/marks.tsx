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

import {
  HATCH_BOX,
  SCRIBBLE_INFLATE,
  fnv1a,
  hatchStrokes,
  marginFlagD,
  MARGIN_FLAG_BOX,
  readingEyesD,
  READING_EYES_BOX,
  mulberry32,
  scribblePath,
  verifyInkD,
  VERIFY_INK_BOX,
  wavingSwatchD,
} from "@/lib/journey-path";
import { verdictInk } from "@/lib/verify-thread-shared";

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
 * Pass 124: the finished check. Two strokes in the same hand as the chalice,
 * wobbled from a seed so a card's tick is always drawn the same way and never
 * from Math.random. It sits on locked work and says only "this is done".
 */
export function GraphiteCheck({
  seed = "locked",
  className = "",
}: {
  seed?: string;
  className?: string;
}) {
  const d = useMemo(() => {
    const rand = mulberry32(fnv1a(seed));
    const jitter = (amount: number) => Math.round((rand() - 0.5) * amount * 10) / 10;
    const x1 = 1.6 + jitter(0.8);
    const y1 = 7.6 + jitter(0.8);
    const xm = 5.6 + jitter(0.6);
    const ym = 11.6 + jitter(0.6);
    const x2 = 14.2 + jitter(0.8);
    const y2 = 2.2 + jitter(0.8);
    return {
      down: `M${x1} ${y1}C${x1 + 1.3} ${y1 + 1.2} ${xm - 1} ${ym - 1.2} ${xm} ${ym}`,
      up: `M${xm} ${ym}C${xm + 2.6} ${ym - 2.6} ${x2 - 2.4} ${y2 + 2.4} ${x2} ${y2}`,
    };
  }, [seed]);

  return (
    <svg
      className={`pointer-events-none shrink-0 ${className}`}
      width={16}
      height={14}
      viewBox="0 0 16 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-testid="graphite-check"
      aria-hidden
    >
      <path d={d.down} />
      <path d={d.up} />
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
export function GraphiteRule({
  className = "",
  animated = false,
}: {
  className?: string;
  /** Draws the stroke in on mount, as if pencilled just now. */
  animated?: boolean;
}) {

  return (
    <svg
      className={`nb-title-rule ${animated ? "nb-title-rule-animated" : ""} pointer-events-none ${className}`}
      viewBox="0 0 300 6"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path
        pathLength={1}
        d="M1 3.4C38 2.2 74 4.2 111 3.1c36-1 72 1.4 108 .5 27-.7 54 1.1 80 .6"
        strokeWidth={1.5}
      />
      <path
        pathLength={1}
        d="M1 4.2C44 3.4 88 4.8 132 4.1c40-.6 80 .9 120 .3"
        strokeWidth={0.7}
        opacity={0.55}
      />
    </svg>
  );
}

/**
 * The front-door rule: a single loose pencil stroke, wavier than the ruled
 * line, drawn in left to right on mount. Used on the public landing page
 * where the pitch closes and the story opens.
 */
export function FrontDoorRule({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`nb-frontdoor-rule pointer-events-none ${className}`}
      viewBox="0 0 300 10"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path
        pathLength={1}
        d="M1 5.6C13 3.2 21 8 35 5.2c13.5-2.7 21.5 3.2 35 .4 13-2.6 20.5 3.4 34.5 1 13-2.2 21 3 34.5.6 13.5-2.4 21.5 2.8 35 .4 13-2.3 21 2.9 34 .8 13-2 20.5 2.6 33.5.5 11.5-1.8 18.5 1.9 27 .2"
        strokeWidth={1.4}
      />
    </svg>
  );
}

/**
 * The scroll cue on the landing page: a handwritten note and a hand-drawn
 * arrow pointing down into the story. It bobs gently; the bob is dropped
 * under prefers-reduced-motion in CSS.
 */
export function ScrollCue({ label = "Scroll to learn more" }: { label?: string }) {
  return (
    <div className="nb-scroll-cue pointer-events-none flex flex-col items-center gap-1">
      <span className="nb-scroll-cue-label">{label}</span>
      <svg
        className="nb-scroll-cue-arrow"
        width={26}
        height={44}
        viewBox="0 0 26 44"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* the wobbly stem */}
        <path d="M13.2 2.4C11.8 12 14.2 20 12.6 29c-.5 3 .2 5.4-.1 8.4" />
        {/* the arrowhead */}
        <path d="M5.4 30.8c2.4 2.6 4.8 5.6 7.4 8.4 2.8-2.6 5.2-5.8 7.6-8.8" />
      </svg>
    </div>
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

/**
 * The mark for work that is an app rather than a document. Hand drawn in the
 * same construction as the chalice: line art, no fill, currentColor.
 */
export function RobotMark({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`pointer-events-none shrink-0 ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="App"
    >
      <title>App</title>
      {/* the antenna */}
      <path d="M12 3.1c.1 1 .1 1.9 0 2.8" />
      <path d="M11.4 2.6c.5-.4 1.1-.3 1.4.2" />
      {/* the head */}
      <path d="M6.2 6.4c3.9-.5 7.9-.5 11.7-.1.4 3.4.4 6.8 0 10.2-3.9.4-7.9.4-11.8 0-.4-3.4-.3-6.8.1-10.1" />
      {/* the eyes */}
      <path d="M9.4 10.4c.1.5.1 1 0 1.5" />
      <path d="M14.7 10.4c.1.5.1 1 0 1.5" />
      {/* the mouth */}
      <path d="M9.6 14.2c1.6.3 3.2.3 4.9 0" />
      {/* the ears */}
      <path d="M4.4 9.6c-.2 1.2-.2 2.4 0 3.6" />
      <path d="M19.7 9.6c.2 1.2.2 2.4 0 3.6" />
    </svg>
  );
}

/**
 * The completion mark: a graphite scribble crossed over the thing that is
 * finished, plus two small dots of punctuation. Transient by contract: the
 * host unmounts whatever it crosses out, so this end state never rests on an
 * idle card.
 */
export function PencilScribble({
  width,
  height,
  seed,
  skipped = false,
  onDone,
  className = "",
}: {
  width: number;
  height: number;
  seed: string;
  /** Reduced motion, or a skipped run: everything appears already drawn. */
  skipped?: boolean;
  onDone?: (() => void) | undefined;
  className?: string;
}) {
  const { d, len } = scribblePath(width, height, seed);
  const pad = SCRIBBLE_INFLATE;
  const dotY = height / 2;

  return (
    <svg
      data-testid="pencil-scribble"
      className={`pointer-events-none absolute left-0 top-0 ${skipped ? "is-skipped" : ""} ${className}`}
      width={width + pad * 2 + 16}
      height={height + pad * 2}
      viewBox={`${-pad} ${-pad} ${width + pad * 2 + 16} ${height + pad * 2}`}
      style={{ marginLeft: -pad, marginTop: -pad }}
      aria-hidden
    >
      <path
        key={seed}
        data-testid="pencil-scribble-path"
        d={d}
        fill="none"
        stroke="var(--nb-graphite)"
        strokeWidth={2.25}
        strokeLinecap="round"
        opacity={0.55}
        strokeDasharray={len}
        strokeDashoffset={skipped ? 0 : len}
        style={skipped ? undefined : { animation: "nb-scribble-draw 420ms cubic-bezier(0.55, 0.06, 0.35, 0.95) forwards" }}
        onAnimationEnd={onDone}
      />
      {[0, 1].map((i) => (
        <circle
          key={i}
          data-testid={`pencil-scribble-dot-${i}`}
          cx={width + 6 + i * 6}
          cy={dotY}
          r={1.5}
          fill="var(--nb-graphite)"
          opacity={0.5}
          style={
            skipped
              ? undefined
              : {
                  transformOrigin: `${width + 6 + i * 6}px ${dotY}px`,
                  animation: `nb-scribble-dot 80ms ease-out ${420 + i * 80}ms both`,
                }
          }
        />
      ))}
    </svg>
  );
}

/**
 * PASS 127: verification ink around one claim span in a transcript.
 *
 * The stroke and the wash are verdict tokens, never a colour at point of use,
 * and never --destructive. Absence draws dashed, so the mark is legible with
 * no colour at all. The span is always the model's own words: the caller is
 * responsible for never wrapping a human turn, and the server drops any
 * finding that tried to.
 */
export function VerifyInk({
  verdict,
  seed,
  active = false,
  reducedMotion = false,
  bold = false,
  children,
}: {
  verdict: string;
  seed: string;
  active?: boolean;
  reducedMotion?: boolean;
  /** A draft finding draws bold. A settled one keeps the ink, quietly. */
  bold?: boolean;
  children: React.ReactNode;
}) {
  const ink = verdictInk(verdict);
  const d = useMemo(() => verifyInkD(seed), [seed]);
  return (
    <span
      data-testid={`verify-ink-${seed}`}
      data-verdict={verdict}
      data-stroke={ink.stroke}
      data-dashed={ink.dashed ? "true" : "false"}
      data-bold={bold ? "true" : "false"}
      className={`relative inline rounded-[3px] px-0.5 ${bold ? "nb-ink-bold" : ""} ${
        active && !reducedMotion ? "nb-ink-settle nb-span-pulse" : ""
      }`}
      style={{
        backgroundColor: ink.wash,
        ...(bold ? { ["--nb-verify-stroke" as string]: ink.stroke } : {}),
        ...(bold ? {} : { opacity: 0.55 }),
      }}
    >
      {children}
      <svg
        aria-hidden
        viewBox={`0 0 ${VERIFY_INK_BOX.width} ${VERIFY_INK_BOX.height}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <path
          d={d}
          fill="none"
          stroke={ink.stroke}
          strokeWidth={bold ? 2.2 : 1.4}
          strokeLinecap="round"
          {...(ink.dashed ? { strokeDasharray: "5 4" } : {})}
        />
      </svg>
    </span>
  );
}

/**
 * PASS 128: the margin flag. One small drawn loop in the transcript's left
 * gutter beside a flagged turn, in that finding's verdict ink. Tapping it is
 * the same gesture as tapping the finding on the rail.
 */
export function MarginFlag({
  seed,
  verdict,
  onActivate,
  label,
  stroke,
  dashed,
}: {
  seed: string;
  verdict: string;
  onActivate?: () => void;
  label: string;
  /** An explicit ink, for surfaces where no verdict is being expressed. */
  stroke?: string | undefined;
  dashed?: boolean | undefined;
}) {
  const base = verdictInk(verdict);
  const ink = {
    stroke: stroke ?? base.stroke,
    dashed: dashed ?? base.dashed,
  };
  const d = useMemo(() => marginFlagD(seed), [seed]);
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={`margin-flag-${seed}`}
      data-verdict={verdict}
      onClick={onActivate}
      className="grid h-[14px] w-[14px] shrink-0 place-items-center"
    >
      <svg
        viewBox={`0 0 ${MARGIN_FLAG_BOX.width} ${MARGIN_FLAG_BOX.height}`}
        width={MARGIN_FLAG_BOX.width}
        height={MARGIN_FLAG_BOX.height}
        fill="none"
        aria-hidden
      >
        <path
          d={d}
          stroke={ink.stroke}
          strokeWidth={1.3}
          strokeLinecap="round"
          {...(ink.dashed ? { strokeDasharray: "3 3" } : {})}
        />
      </svg>
    </button>
  );
}

/**
 * PASS 135 — the reading eyes. While the model reads the chat, a friendly pair
 * of drawn spectacles sits centred in the transcript and tracks its eyes along
 * the line, the way a person reads. Graphite only, aria-hidden, no telemetry.
 * The motion is one CSS keyframe loop, so there is nothing to clean up: it
 * stops when the element unmounts. Reduced motion holds the pupils centred.
 */
export function ReadingEyes({
  animate = true,
  seed = "reading-eyes",
  className = "",
}: {
  animate?: boolean;
  seed?: string;
  className?: string;
}) {
  const eyes = useMemo(() => readingEyesD(seed), [seed]);
  return (
    <span
      data-testid="reading-eyes"
      className={`nb-reading-eyes pointer-events-none ${className}`}
      aria-hidden
    >
      <span className="nb-reading-eyes-halo" />
      <svg
        className="nb-reading-eyes-svg"
        viewBox={`0 0 ${READING_EYES_BOX.width} ${READING_EYES_BOX.height}`}
        width={READING_EYES_BOX.width * READING_EYES_SCALE}
        height={READING_EYES_BOX.height * READING_EYES_SCALE}
        fill="none"
        stroke="var(--nb-graphite)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {eyes.frame.map((d, index) => (
          <path
            key={`lens-${index}`}
            d={d}
            fill="color-mix(in oklab, var(--nb-green) 12%, transparent)"
            stroke="none"
          />
        ))}
        {eyes.frame.map((d, index) => (
          <path key={index} d={d} stroke="var(--nb-green-deep)" />
        ))}
        {eyes.pupils.map((pupil, index) => (
          <circle
            key={`p-${index}`}
            className={animate ? "nb-reading-pupil" : "nb-reading-pupil nb-reading-pupil-static"}
            cx={pupil.cx}
            cy={pupil.cy}
            r={pupil.r}
            fill="var(--nb-graphite)"
            stroke="none"
          />
        ))}
      </svg>

    </span>
  );
}
