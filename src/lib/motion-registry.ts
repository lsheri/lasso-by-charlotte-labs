/**
 * 06 · Motion registry — page `1:7`, frame `18:2`.
 *
 * A screen never picks an animation. It names an event, and this table decides
 * what plays. Changing the app's motion personality is editing one column here.
 *
 * Every event carries a reduced-motion answer that says the same thing without
 * moving. Reduced motion removes movement, never meaning.
 *
 * The five auditability events are a promise rather than decoration: they are
 * the visible evidence of what the software read and where a claim came from.
 * Never remove one, and never make one optional.
 *
 * Two events on the Figma table are deliberately absent from this map:
 *   - `region.circled` is marked PROPOSED and has no surface behind it.
 *   - the landing hero event is marketing only and is inside the founder
 *     freeze on route `/`. It must never be added here.
 */

export type MotionGroup = "auditability" | "record" | "thinking" | "chrome";

/** The 16 motions the registry can resolve to. */
export type MotionName =
  | "reading-line"
  | "pencil-marks-underline"
  | "trace-back"
  | "provenance-ribbon"
  | "work-lands"
  | "paper-physics-pile"
  | "the-lasso"
  | "stamp"
  | "pencil-marks-tick"
  | "comet-line"
  | "card-lifts"
  | "breathing-dots"
  | "spider-looks-again"
  | "spider-processes"
  | "pencil-marks"
  | "arrows";

export type MotionEventName =
  // Auditability. Never remove one of these.
  | "record.reading"
  | "verify.reading"
  | "verify.flagged"
  | "provenance.tracing"
  | "provenance.shown"
  // The record moves.
  | "work.lands"
  | "work.piles"
  | "claim.lassoed"
  | "record.stamped"
  | "call.logged"
  | "share.sending"
  | "feedback.pinned"
  // The app is thinking.
  | "ai.thinking"
  | "ai.working"
  | "spider.guiding"
  | "connector.connecting"
  // Chrome. The landing hero event is not here and must not be added.
  | "page.enter"
  | "nav.active"
  | "arrow.drawn";

export interface MotionEntry {
  readonly group: MotionGroup;
  /** The motion that plays when movement is allowed. */
  readonly motion: MotionName;
  /** What is shown instead when the reader asked for less movement. */
  readonly reduced: string;
  /** True for the five auditability events. Never gate these on taste. */
  readonly promise: boolean;
}

export const MOTION_REGISTRY: Readonly<Record<MotionEventName, MotionEntry>> = {
  "record.reading": {
    group: "auditability",
    motion: "reading-line",
    reduced: "The list of what is read, stated in full",
    promise: true,
  },
  "verify.reading": {
    group: "auditability",
    motion: "reading-line",
    reduced: "Progress text naming the turn being read",
    promise: true,
  },
  "verify.flagged": {
    group: "auditability",
    motion: "pencil-marks-underline",
    reduced: "The underline appears, no draw",
    promise: true,
  },
  "provenance.tracing": {
    group: "auditability",
    motion: "trace-back",
    reduced: "Sources appear as a list, newest last",
    promise: true,
  },
  "provenance.shown": {
    group: "auditability",
    motion: "provenance-ribbon",
    reduced: "Static ribbon with the same words",
    promise: true,
  },

  "work.lands": {
    group: "record",
    motion: "work-lands",
    reduced: "Fade in, no drop",
    promise: false,
  },
  "work.piles": {
    group: "record",
    motion: "paper-physics-pile",
    reduced: "Instant reflow",
    promise: false,
  },
  "claim.lassoed": {
    group: "record",
    motion: "the-lasso",
    reduced: "A static outline appears",
    promise: false,
  },
  "record.stamped": {
    group: "record",
    motion: "stamp",
    reduced: "The badge appears with its date",
    promise: false,
  },
  "call.logged": {
    group: "record",
    motion: "pencil-marks-tick",
    reduced: "The tick appears",
    promise: false,
  },
  "share.sending": {
    group: "record",
    motion: "comet-line",
    reduced: "Fade, then the confirmation",
    promise: false,
  },
  "feedback.pinned": {
    group: "record",
    motion: "card-lifts",
    reduced: "Fade in",
    promise: false,
  },

  "ai.thinking": {
    group: "thinking",
    motion: "breathing-dots",
    reduced: "Thinking…",
    promise: false,
  },
  "ai.working": {
    group: "thinking",
    motion: "spider-looks-again",
    reduced: "Working…",
    promise: false,
  },
  "spider.guiding": {
    group: "thinking",
    motion: "spider-processes",
    reduced: "The spider holds still",
    promise: false,
  },
  "connector.connecting": {
    group: "thinking",
    motion: "breathing-dots",
    reduced: "Connecting…",
    promise: false,
  },

  "page.enter": {
    group: "chrome",
    motion: "card-lifts",
    reduced: "Content appears",
    promise: false,
  },
  "nav.active": {
    group: "chrome",
    motion: "pencil-marks",
    reduced: "The active card appears",
    promise: false,
  },
  "arrow.drawn": {
    group: "chrome",
    motion: "arrows",
    reduced: "Static arrows",
    promise: false,
  },
};

interface MotionDraw {
  /** The class drawn when movement is allowed. */
  readonly moving: string;
  /** The class drawn instead when the reader asked for less movement. */
  readonly still?: string;
}

/**
 * What each motion is drawn with. A motion absent from this map has no class
 * of its own yet, and the calling surface keeps whatever it draws today.
 *
 * Nothing here invents an animation. Every value already exists in
 * `styles.css` or in `marks.tsx`.
 *
 * Deliberately absent, each for a reason, so nobody fills these in by guessing:
 *   - `reading-line`: `.nb-reading-pupil` is the spider's eye, not a line
 *     moving down text. The motion has no counterpart anywhere.
 *   - `provenance-ribbon`: `.nb-traced-legend` is a legend line inside
 *     JourneyView, not a ribbon.
 *   - `work-lands`: the only downward landing in the app is `nb-paper-land`,
 *     which belongs to the gust, a named registry exception fired by chance
 *     rather than by this event. `.nb-rise` moves the wrong way, upward.
 *   - `comet-line`: nothing in the app draws one.
 *   - `pencil-marks`: `.nb-mark` exists, but `nav.active` renders no SVG for a
 *     mark to be drawn on. Returning a class the surface cannot use is worse
 *     than returning nothing.
 *   - `arrows`: `.nb-journey-arrow` only has effect nested inside
 *     `.nb-journey`, so it is not a class a surface can be handed.
 */
const MOTION_CLASS: Partial<Record<MotionName, MotionDraw>> = {
  "breathing-dots": { moving: "nb-dots" },
  "card-lifts": { moving: "nb-card-lift" },
  "spider-looks-again": { moving: "nb-spider-wobble" },
  "spider-processes": { moving: "nb-spider-reading" },
  "pencil-marks-underline": { moving: "nb-ink-settle nb-span-pulse" },
  "trace-back": { moving: "nb-thread-draw" },
  "paper-physics-pile": { moving: "nb-paper" },
  "the-lasso": { moving: "nb-lasso-wrap" },
  stamp: { moving: "nb-ship-settle" },
  "pencil-marks-tick": { moving: "nb-mark" },
};

/** True when the reader has asked for less movement. Safe during SSR. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export interface ResolvedMotion {
  readonly event: MotionEventName;
  readonly motion: MotionName;
  /** The class to draw with, or "" when movement is off or none exists. */
  readonly className: string;
  /** True when the surface should show words instead of movement. */
  readonly still: boolean;
  /** The words that carry the same information when nothing moves. */
  readonly reduced: string;
  readonly promise: boolean;
}

/**
 * Resolve an event to what should play. A surface names the event and reads
 * the answer; it never names an animation.
 */
export function resolveMotion(
  event: MotionEventName,
  reduce = prefersReducedMotion(),
): ResolvedMotion {
  const entry = MOTION_REGISTRY[event];
  const draw = MOTION_CLASS[entry.motion];
  return {
    event,
    motion: entry.motion,
    className: reduce ? (draw?.still ?? "") : (draw?.moving ?? ""),
    still: reduce,
    reduced: entry.reduced,
    promise: entry.promise,
  };
}
