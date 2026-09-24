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

/** The motions the registry can resolve to. */
export type MotionName =
  | "call-settles"
  | "record-label"
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
  | "note-lands"
  | "circle-drawn"
  /** Pass E2 · Find it. Candidates arrive from the right while it reads. */
  | "candidates-drift"
  /** Pass E2 · Find it. The line from a candidate to the work draws on. */
  | "lines-draw"
  /** Pass E2 · Find it. The check on a source a person chose to keep. */
  | "keep-check"
  /** Pass E2 · Find it. Rows of what was said, arriving in order. */
  | "rows-land"
  | "arrows"
  | "workboard-unfold"
  | "context-corona";

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
  /** Pass B: a drafted call was confirmed. The check draws on, the card settles. */
  | "decision.confirmed"
  /** Pass B: the on the record label, which waits for the check to finish. */
  | "decision.on_record_shown"
  /** Pass C: a sticky note joins the wall for the next 1:1. */
  | "oneonone.note_landed"
  /** Pass D: a new note from a coach, circled around the work it points at. */
  | "coachnote.arrived"
  | "share.sending"
  | "feedback.pinned"
  // The app is thinking.
  | "ai.thinking"
  | "ai.working"
  | "spider.guiding"
  | "connector.connecting"
  // Chrome. The landing hero event is not here and must not be added.
  /** Pass E2: Find it is reading the conversations it can see. */
  | "findit.reading"
  /** Pass E2: what fed this piece of work has landed. */
  | "findit.found"
  /** Pass E2: a person kept one of those as a source. */
  | "findit.kept"
  /** Pass E2: rows of what was said have landed. */
  | "findit.search_landed"
  | "page.enter"
  | "nav.active"
  | "arrow.drawn"
  | "canvas.unfolded"
  | "context.picked";

interface MotionEventEntry {
  readonly group: MotionGroup;
  /** The motion that plays when movement is allowed. */
  readonly motion: MotionName;
  /** What is shown instead when the reader asked for less movement. */
  readonly reduced: string;
  /** True for the five auditability events. Never gate these on taste. */
  readonly promise: boolean;
}

const MOTION_EVENT_REGISTRY: Readonly<Record<MotionEventName, MotionEventEntry>> = {
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
  "decision.confirmed": {
    group: "record",
    motion: "call-settles",
    reduced: "The check appears, the card does not move",
    promise: false,
  },
  "decision.on_record_shown": {
    group: "record",
    motion: "record-label",
    reduced: "The label is simply there, beside the check",
    promise: false,
  },
  "oneonone.note_landed": {
    group: "record",
    motion: "note-lands",
    reduced: "The note is simply there, at the end of the wall",
    promise: false,
  },
  "coachnote.arrived": {
    group: "record",
    motion: "circle-drawn",
    reduced: "The circle is already drawn, around the same thing",
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

  "findit.reading": {
    group: "thinking",
    motion: "candidates-drift",
    reduced: "The cards sit still, and the line says how many conversations are being read",
    promise: false,
  },
  "findit.found": {
    group: "record",
    motion: "lines-draw",
    reduced: "The lines are already there, joining the same work",
    promise: false,
  },
  "findit.kept": {
    group: "record",
    motion: "keep-check",
    reduced: "The check appears, the card does not move",
    promise: false,
  },
  "findit.search_landed": {
    group: "record",
    motion: "rows-land",
    reduced: "The rows are simply there, in the order they were found",
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
  "canvas.unfolded": {
    group: "chrome",
    motion: "workboard-unfold",
    reduced: "Workboard open",
    promise: false,
  },
  "context.picked": {
    group: "chrome",
    motion: "context-corona",
    reduced: "A still lime glow; nothing moves",
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
  "call-settles": { moving: "nb-call-settle" },
  "record-label": { moving: "nb-record-label" },
  "note-lands": { moving: "nb-note-land" },
  "circle-drawn": { moving: "nb-circle-draw", still: "nb-circle-still" },
  "candidates-drift": { moving: "nb-findit-drift" },
  "lines-draw": { moving: "nb-findit-line", still: "nb-findit-line-still" },
  "keep-check": { moving: "nb-findit-kept" },
  "rows-land": { moving: "nb-findit-row" },
  "workboard-unfold": { moving: "canvas-lab-unfold" },
  "context-corona": { moving: "canvas-lab-context-corona-motion" },
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
  const entry = MOTION_EVENT_REGISTRY[event];
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
