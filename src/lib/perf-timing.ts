import { logEvent } from "./telemetry";

/**
 * Client-side interaction timing, routed through the existing server-side
 * telemetry path. There is no browser analytics SDK involved and none should
 * be added for this.
 *
 * CONTENT RULE: this event carries durations and enums only. The emit function
 * below builds the dims object itself from a fixed allowlist, so a call site
 * physically cannot attach a title, an id, a file name or any free text. That
 * is a guarantee, not a policy: do not add a passthrough export.
 *
 * DELIBERATE DEPARTURE FROM HOUSE STYLE: duration_ms is exact, not bucketed.
 * Everything else in this pipeline buckets counts because those are part of the
 * longitudinal research record. This is short retention operational data that
 * never joins that record, and percentiles are the whole point. Do not "fix"
 * this by bucketing it.
 */

/** The frozen vocabulary. An unrecognised name emits nothing. */
export const PERF_NAMES = Object.freeze([
  "workstream.drag_remap",
  "engagement.load",
  "canvas.open",
  "audit.open",
  "slide.render",
  "lasso.resolve",
  "ask_dock.open",
  "connector.sync",
  "peek.open",
] as const);

export type PerfName = (typeof PERF_NAMES)[number];

export const PERF_PHASES = Object.freeze(["paint", "write", "refetch", "total"] as const);
export type PerfPhase = (typeof PERF_PHASES)[number];

export type PerfSurface = "owner" | "coach";
export type PerfState = "cold" | "warm";

const NAME_SET: ReadonlySet<string> = new Set(PERF_NAMES);
const PHASE_SET: ReadonlySet<string> = new Set(PERF_PHASES);

/** Anything longer than this is a tab that went to sleep, not an interaction. */
const MAX_DURATION_MS = 120_000;

/** Repeated paint emits for the same name inside this window are dropped. */
export const PERF_PAINT_COALESCE_MS = 1000;

const lastPaintAt = new Map<string, number>();

/** Test seam. */
export function resetPerfCoalescing(): void {
  lastPaintAt.clear();
}

function warn(message: string): void {
  if (import.meta.env?.DEV) console.warn(`[perf-timing] ${message}`);
}

export type PerfIdentity = {
  orgId: string | null | undefined;
  surface: PerfSurface;
};

export type PerfEmitInput = PerfIdentity & {
  name: PerfName;
  durationMs: number;
  phase: PerfPhase;
  state: PerfState;
};

/**
 * The only way a perf.interaction row can be written. Builds dims itself from
 * exactly five keys; any extra key a caller supplies is dropped on the floor.
 */
export function emitPerfInteraction(input: PerfEmitInput): boolean {
  const { name, phase, surface, state, orgId } = input;

  if (!NAME_SET.has(name as string)) {
    warn(`unknown interaction name, nothing emitted: ${String(name)}`);
    return false;
  }
  if (!PHASE_SET.has(phase as string)) {
    warn(`unknown phase, nothing emitted: ${String(phase)}`);
    return false;
  }
  if (surface !== "owner" && surface !== "coach") return false;
  if (state !== "cold" && state !== "warm") return false;
  if (!orgId) return false;

  const raw = Number(input.durationMs);
  if (!Number.isFinite(raw)) return false;
  const duration_ms = Math.min(MAX_DURATION_MS, Math.max(0, Math.round(raw)));

  if (phase === "paint") {
    const now = Date.now();
    const previous = lastPaintAt.get(name);
    if (previous !== undefined && now - previous < PERF_PAINT_COALESCE_MS) return false;
    lastPaintAt.set(name, now);
  }

  logEvent("perf.interaction", orgId, { name, duration_ms, phase, surface, state });
  return true;
}

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/**
 * "Usable" means the frame after React has committed the change. A double
 * requestAnimationFrame lands us just past that commit's paint, which is the
 * honest end of a gesture. It is never the network call returning, and never
 * the end of a deliberate reveal animation.
 */
export function afterPaint(run: () => void): void {
  if (typeof requestAnimationFrame !== "function") {
    run();
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(run));
}

export type PerfTimer = {
  /** Emit the elapsed time for one phase, measured from the gesture. */
  mark(phase: PerfPhase): void;
  /** Emit a phase on the frame after the next commit paints. */
  markAfterPaint(phase: PerfPhase): void;
  /** Emit the total and close the timer. Later marks are ignored. */
  done(phase?: PerfPhase): void;
  /** Drop the timer without emitting anything. */
  cancel(): void;
};

const INERT: PerfTimer = Object.freeze({
  mark: () => {},
  markAfterPaint: () => {},
  done: () => {},
  cancel: () => {},
});

export function startPerfTimer(
  name: PerfName,
  identity: PerfIdentity,
  state: PerfState = "cold",
): PerfTimer {
  if (!identity.orgId || !NAME_SET.has(name)) return INERT;
  const t0 = now();
  let closed = false;

  const emit = (phase: PerfPhase, at: number) => {
    emitPerfInteraction({
      name,
      phase,
      state,
      surface: identity.surface,
      orgId: identity.orgId,
      durationMs: at - t0,
    });
  };

  return {
    mark(phase) {
      if (closed) return;
      emit(phase, now());
    },
    markAfterPaint(phase) {
      if (closed) return;
      afterPaint(() => emit(phase, now()));
    },
    done(phase = "total") {
      if (closed) return;
      closed = true;
      emit(phase, now());
    },
    cancel() {
      closed = true;
    },
  };
}

/**
 * Gesture-anchored opens. The gesture records a start; whatever surface mounts
 * finishes it once it is usable. Keeps prop drilling out of the call sites.
 */
const openStarts = new Map<PerfName, number>();

export function markOpenStart(name: PerfName): void {
  if (!NAME_SET.has(name)) return;
  openStarts.set(name, now());
}

export function takeOpenStart(name: PerfName): number | null {
  const t0 = openStarts.get(name);
  if (t0 === undefined) return null;
  openStarts.delete(name);
  return t0;
}

export function clearOpenStarts(): void {
  openStarts.clear();
}

/**
 * In-app navigation only. A hard document load plus hydration is a different
 * measurement with a different anchor, and it is deliberately not covered in
 * this pass.
 */
let navStart: number | null = null;

export function markNavStart(): void {
  navStart = now();
}

export function takeNavStart(): number | null {
  const t0 = navStart;
  navStart = null;
  return t0;
}

export function finishFromStart(
  name: PerfName,
  t0: number | null,
  identity: PerfIdentity,
  state: PerfState,
  phase: PerfPhase = "total",
): void {
  if (t0 === null) return;
  afterPaint(() => {
    emitPerfInteraction({
      name,
      phase,
      state,
      surface: identity.surface,
      orgId: identity.orgId,
      durationMs: now() - t0,
    });
  });
}
