import type { CSSProperties } from "react";

import { resolvedLinework } from "@/lib/lasso-loop";

export const ASK_THINKING_COPY = {
  reading: "Reading your work",
  read: (n: number) => `Read ${n} ${n === 1 ? "piece" : "pieces"} of work`,
} as const;

const GLYPH_SIZE = 46;

/** A1 keyframes live with the component, never in the global stylesheet. */
export const ASK_THINKING_STYLES = `
@keyframes ask-a1-flicker { 0%, 100% { opacity: 0.34; } 45% { opacity: 1; } 70% { opacity: 0.72; } }
@keyframes ask-a1-draw { 0% { stroke-dashoffset: 1; } 48% { stroke-dashoffset: 0; } 52% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -1; } }
@keyframes ask-a1-dot { 0%, 100% { opacity: 0.25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }
.ask-a1-flicker { animation: ask-a1-flicker 2600ms ease-in-out infinite; }
.ask-a1-glyph path { stroke-dasharray: 1; stroke-dashoffset: 0; }
.ask-a1-glyph[data-state="thinking"] path { animation: ask-a1-draw 2200ms ease-in-out infinite; }
.ask-a1-glyph[data-state="thinking"] { color: var(--nb-lasso-green); filter: drop-shadow(0 0 6px color-mix(in srgb, var(--nb-lasso-green) 55%, transparent)); }
.ask-a1-glyph[data-state="settled"] { color: var(--nb-green-deep); }
.ask-a1-dot { display: inline-block; width: 4px; height: 4px; border-radius: 9999px; background: currentColor; }
.ask-a1-dot[data-pulse="true"] { animation: ask-a1-dot 1200ms ease-in-out infinite; }
@keyframes ask-a1-name-in { from { opacity: 0; } to { opacity: 1; } }
.ask-a1-name-in { animation: ask-a1-name-in 340ms ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .ask-a1-flicker, .ask-a1-glyph path, .ask-a1-dot, .ask-a1-name-in { animation: none !important; }
  .ask-a1-glyph { filter: none !important; }
}
`;

/** Source line flicker: one loop each, staggered -870ms per line, cycling every three. */
export function askFlickerStyle(index: number, { answered, reduced }: { answered: boolean; reduced: boolean }): { className?: string; style?: CSSProperties; "data-a1-flicker"?: string } {
  if (answered) return { style: { opacity: 1 } };
  if (reduced) return { style: { opacity: 0.7 } };
  return { "data-a1-flicker": "on", style: { animation: `ask-a1-flicker 2600ms ease-in-out ${-870 * (index % 3)}ms infinite` } };
}

/** The same artwork the loop mark resolves to, as inline SVG so it can be drawn. */
function AskGlyph({ state }: { state: "thinking" | "settled" }) {
  const paths = resolvedLinework(GLYPH_SIZE, 0);
  return (
    <svg data-testid="ask-thinking-glyph" data-state={state} className="ask-a1-glyph shrink-0" width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox={`0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}`} aria-hidden>
      {paths.map((path, index) => {
        const d = path.points.map((point, i) => `${i === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ") + (path.closed ? " Z" : "");
        return <path key={index} d={d} pathLength={1} fill="none" stroke="currentColor" strokeWidth={Math.max(1.35, GLYPH_SIZE * 0.034)} strokeLinejoin="round" strokeLinecap="round" />;
      })}
    </svg>
  );
}

export function AskThinkingFoot({ answered, reduced, count, elapsed }: { answered: boolean; reduced: boolean; count: number; elapsed: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground" data-testid="ask-thinking-foot">
      <AskGlyph state={answered || reduced ? "settled" : "thinking"} />
      <span>{answered ? ASK_THINKING_COPY.read(count) : ASK_THINKING_COPY.reading}</span>
      {answered ? null : (
        <span className="inline-flex items-center gap-[3px]" data-testid="ask-thinking-dots" aria-hidden>
          {[0, 1, 2].map((i) => <span key={i} className="ask-a1-dot" data-pulse={reduced ? "false" : "true"} style={reduced ? { opacity: 0.6 } : { animationDelay: `${i * 160}ms` }} />)}
        </span>
      )}
      <span className="ml-auto font-mono text-[11px] tabular-nums">{elapsed}</span>
    </div>
  );
}
