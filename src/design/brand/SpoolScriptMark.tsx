/* The Spool script mark (19 Nov 2026, brand exploration: Slate cloth, Spool script). A lasso is a rope and thread is a
   small rope: the thread leaves a spool and writes a cursive l. A drawn SVG, never a typeface.
   Rendered only by the brand switches (see brand-marks.ts). It lives here, beside the Charlotte mark, because the design guards allow brand
   drawings to read job tokens only inside src/design/brand when the brand's look asks for it. */
import type { CSSProperties } from "react";

import "./spool-script-mark.css";

/** rest: thread in ink (nav, favicon). live: thread in the live colour. drawing: the live thread draws on once, then holds. */
export type SpoolMarkState = "rest" | "live" | "drawing";

export const SPOOL_FLANGES = "M5 30H23M5 52H23";
export const SPOOL_CORE = "M10 30V52M18 30V52";
export const SPOOL_THREAD =
  "M10 37H18M10 43H18C29 43 41 30 41 16C41 8 33 8 33 17C33 31 36 45 45 45C50 45 54 43 57 39";

/** At this size and below the two core lines close up with the wound thread, so they are left out. */
export const SPOOL_CORE_MIN_PX = 17;

const round = (n: number) => Math.round(n * 100) / 100;

/** Stroke widths in viewBox units for a pixel size. Small marks (24px and below) are drawn heavier so they hold. */
export function spoolWeights(size: number) {
  const small = size <= 24;
  const k = small ? 0.75 : 0.55;
  const thread = small ? 4.6 : 3.4;
  return {
    small,
    main: round((small ? 5.2 : 3.6) * k),
    fine: round((small ? 3.4 : 1.8) * k),
    thread,
    /** The ink stroke under a lime thread, so lime (1.24:1 on the Slate ground) never sits bare on a light surface. */
    outline: round(thread + (small ? 3.2 : 2.6)),
    core: size >= SPOOL_CORE_MIN_PX,
  };
}

export function SpoolScriptMark({
  size = 32,
  state = "rest",
  onDark = false,
}: {
  size?: number;
  state?: SpoolMarkState;
  /** On a dark surface the lime thread needs no ink outline. */
  onDark?: boolean;
}) {
  const w = spoolWeights(size);
  const lit = state !== "rest";
  const style = {
    "--spool-main": w.main,
    "--spool-fine-w": w.fine,
    "--spool-thread-w": w.thread,
    "--spool-outline-w": w.outline,
  } as CSSProperties;
  return (
    <svg
      // Remount per state, so the draw-on runs again each time work starts.
      key={state}
      className="spool-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={style}
      data-spool-state={state}
      data-brand-mark="slate-spool"
      data-size={size}
    >
      <path className="spool-main" d={SPOOL_FLANGES} />
      {w.core ? <path className="spool-fine" d={SPOOL_CORE} /> : null}
      {lit && !onDark ? <path className="spool-outline" d={SPOOL_THREAD} pathLength={1} /> : null}
      <path className="spool-thread" d={SPOOL_THREAD} pathLength={1} />
    </svg>
  );
}
