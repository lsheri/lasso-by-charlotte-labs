/**
 * M9 · Arrows · what fed what.
 *
 * Hand-drawn elbow arrows draw between what fed what, in order. Open heads. A
 * card lands, then the next arrow starts. One thing moves at a time, ever.
 *
 * This is illustration: aria-hidden, pointer-events-none, never focusable. It
 * is built once here because two surfaces need the same motion.
 */
import { useEffect, useMemo, useState } from "react";

import { fnv1a, mulberry32 } from "@/lib/journey-path";

export type TrailStop = {
  id: string;
  /** Micro line, e.g. "EMAIL · AUG 23". */
  eyebrow?: string;
  /** The card's line of text. */
  label: string;
};

const CARD_W = 150;
const CARD_H = 42;
const ROW_H = 64;
const VIEW_W = 320;
const LETTER_H = 78;

const CARD_MS = 260;
const ARROW_MS = 420;
const PAUSE_MS = 180;
const HOLD_MS = 2000;

const round = (n: number) => Math.round(n * 10) / 10;

function cardX(index: number): number {
  return index % 2 === 0 ? 10 : 150;
}

function cardY(index: number): number {
  return index * ROW_H + 6;
}

/** Two orthogonal segments, joined by a soft corner, drawn with a loose hand. */
function elbowPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  seed: string,
): string {
  const rand = mulberry32(fnv1a(seed));
  const j = (amount: number) => round((rand() - 0.5) * amount);
  const midY = round((from.y + to.y) / 2 + j(2));
  const x1 = round(from.x + j(1.2));
  const x2 = round(to.x + j(1.2));
  return [
    `M ${x1} ${round(from.y)}`,
    `C ${round(x1 + j(2))} ${round(from.y + 4)} ${round(x1 + j(2))} ${round(midY - 6)} ${x1} ${midY}`,
    `C ${round(x1 + (x2 - x1) * 0.35)} ${round(midY + j(2.4))} ${round(x1 + (x2 - x1) * 0.7)} ${round(midY + j(2.4))} ${x2} ${midY}`,
    `C ${round(x2 + j(2))} ${round(midY + 5)} ${round(x2 + j(2))} ${round(to.y - 6)} ${x2} ${round(to.y)}`,
  ].join(" ");
}

/** Open head: two short strokes at the tip, never a filled triangle. */
function headPaths(x: number, y: number): string[] {
  return [`M ${round(x - 5.5)} ${round(y - 7)} L ${round(x)} ${round(y)}`, `M ${round(x + 5.5)} ${round(y - 7)} L ${round(x)} ${round(y)}`];
}

export function PaperTrail({
  stops,
  end,
  muted = false,
  loop = true,
  className = "",
}: {
  stops: TrailStop[];
  /** Drawn after the last stop, e.g. the letter. */
  end?: "letter" | undefined;
  /** Grey and still, for a state that has not happened yet. */
  muted?: boolean;
  loop?: boolean;
  className?: string;
}) {
  const shown = stops.slice(0, 4);
  const arrowCount = Math.max(shown.length - 1, 0) + (end === "letter" ? 1 : 0);
  const steps = shown.length + arrowCount + (end === "letter" ? 1 : 0);
  const height = shown.length * ROW_H + (end === "letter" ? LETTER_H : 12);

  const [still, setStill] = useState(muted);
  const [step, setStep] = useState(muted ? steps : -1);

  useEffect(() => {
    if (muted) {
      setStill(true);
      setStep(steps);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setStill(true);
      setStep(steps);
      return;
    }
    setStill(false);
    setStep(-1);
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      if (cancelled) return;
      setStep(-1);
      let at = 20;
      for (let i = 0; i < steps; i += 1) {
        // Odd steps are arrows: a card lands, pauses, then its arrow draws.
        const dur = i % 2 === 0 ? CARD_MS : ARROW_MS;
        const index = i;
        timers.push(setTimeout(() => setStep(index), at));
        at += dur + PAUSE_MS;
      }
      if (loop) timers.push(setTimeout(run, at + HOLD_MS));
    };
    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [muted, loop, steps]);

  const ink = muted ? "var(--nb-pencil)" : "var(--nb-graphite)";

  const arrows = useMemo(() => {
    const list: { key: string; d: string; heads: string[]; stepIndex: number }[] = [];
    for (let i = 0; i < shown.length - 1; i += 1) {
      const from = { x: cardX(i) + 40, y: cardY(i) + CARD_H };
      const to = { x: cardX(i + 1) + 40, y: cardY(i + 1) - 1 };
      list.push({
        key: `a${i}`,
        d: elbowPath(from, to, `${shown[i]?.id ?? i}-arrow`),
        heads: headPaths(to.x, to.y),
        stepIndex: i * 2 + 1,
      });
    }
    if (end === "letter" && shown.length > 0) {
      const last = shown.length - 1;
      const from = { x: cardX(last) + 40, y: cardY(last) + CARD_H };
      const to = { x: VIEW_W / 2 - 25, y: shown.length * ROW_H + 8 };
      list.push({
        key: "letter-arrow",
        d: elbowPath(from, to, "letter-arrow"),
        heads: headPaths(to.x, to.y),
        stepIndex: last * 2 + 1,
      });
    }
    return list;
  }, [shown, end]);

  const letterOn = step >= steps - 1;
  const letterX = VIEW_W / 2 - 50;
  const letterY = shown.length * ROW_H + 10;

  return (
    <div
      aria-hidden
      data-testid="paper-trail"
      data-muted={muted ? "true" : "false"}
      className={`pointer-events-none w-full ${className}`}
    >
      <svg
        className={`h-full w-full ${still ? "nb-trail-static" : ""}`}
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        style={{ color: ink }}
        aria-hidden
      >
        {arrows.map((arrow) => (
          <g
            key={arrow.key}
            className={`nb-trail-arrow ${step >= arrow.stepIndex ? "is-on" : ""}`}
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path pathLength={1} d={arrow.d} />
            {arrow.heads.map((head, k) => (
              <path key={k} pathLength={1} d={head} />
            ))}
          </g>
        ))}

        {shown.map((stop, index) => (
          <foreignObject
            key={stop.id}
            x={cardX(index)}
            y={cardY(index)}
            width={CARD_W}
            height={CARD_H}
            className={`nb-trail-card ${step >= index * 2 ? "is-on" : ""}`}
          >
            <div
              style={{
                width: `${CARD_W}px`,
                height: `${CARD_H}px`,
                boxSizing: "border-box",
                background: "var(--nb-white)",
                border: `1px solid ${muted ? "var(--nb-pencil)" : "var(--nb-rule)"}`,
                borderRadius: "3px",
                padding: "5px 8px",
                overflow: "hidden",
                color: ink,
              }}
            >
              {stop.eyebrow ? (
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "9px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    opacity: 0.7,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {stop.eyebrow}
                </p>
              ) : null}
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  lineHeight: "15px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {stop.label}
              </p>
            </div>
          </foreignObject>
        ))}

        {end === "letter" && shown.length > 0 ? (
          <g
            className={`nb-trail-arrow ${letterOn ? "is-on" : ""}`}
            stroke={muted ? "var(--nb-pencil)" : "var(--nb-green)"}
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* the sheet */}
            <path
              pathLength={1}
              d={`M ${letterX} ${letterY + 2} C ${letterX + 30} ${letterY} ${letterX + 68} ${letterY + 1} ${letterX + 100} ${letterY + 2} C ${letterX + 101} ${letterY + 22} ${letterX + 99} ${letterY + 44} ${letterX + 100} ${letterY + 60} C ${letterX + 66} ${letterY + 62} ${letterX + 32} ${letterY + 61} ${letterX} ${letterY + 60} C ${letterX - 1} ${letterY + 40} ${letterX + 1} ${letterY + 20} ${letterX} ${letterY + 2}`}
            />
            {/* the fold */}
            <path
              pathLength={1}
              d={`M ${letterX + 2} ${letterY + 4} C ${letterX + 26} ${letterY + 18} ${letterX + 74} ${letterY + 18} ${letterX + 98} ${letterY + 4}`}
            />
            {/* three ruled strokes for the words */}
            <path pathLength={1} d={`M ${letterX + 14} ${letterY + 32} C ${letterX + 44} ${letterY + 30} ${letterX + 66} ${letterY + 33} ${letterX + 86} ${letterY + 31}`} />
            <path pathLength={1} d={`M ${letterX + 14} ${letterY + 42} C ${letterX + 42} ${letterY + 40} ${letterX + 64} ${letterY + 43} ${letterX + 86} ${letterY + 41}`} />
            <path pathLength={1} d={`M ${letterX + 14} ${letterY + 52} C ${letterX + 36} ${letterY + 50} ${letterX + 52} ${letterY + 53} ${letterX + 66} ${letterY + 51}`} />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
