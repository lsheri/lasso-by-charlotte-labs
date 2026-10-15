import type { CSSProperties } from "react";

import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";

export const ASK_THINKING_COPY = {
  reading: "Reading your work",
  read: (n: number) => `Read ${n} ${n === 1 ? "piece" : "pieces"} of work`,
} as const;

const GLYPH_SIZE = 16;

/** A1 keyframes live with the component, never in the global stylesheet. */
export const ASK_THINKING_STYLES = `
@keyframes ask-a1-flicker { 0%, 100% { opacity: 0.34; } 45% { opacity: 1; } 70% { opacity: 0.72; } }
@keyframes ask-reading-beads { from { offset-distance: 0%; } to { offset-distance: 100%; } }
.ask-a1-flicker { animation: ask-a1-flicker 2600ms ease-in-out infinite; }
.ask-a1-glyph[data-state="thinking"] { display: none; }
.ask-a1-glyph[data-state="settled"] { color: var(--nb-green-deep); }
.ask-reading-beads { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
.ask-reading-beads .ask-a1-dot {
  position: absolute; left: 0; top: 0; width: 3.5px; height: 3.5px;
  border-radius: var(--radius-pill); background: var(--state-highlight);
  offset-path: path("M38 7C33 2 14 1 7 5 1 8 1 15 6 18c6 4 24 4 32 1 7-2 10-6 7-9-2-3-8-4-15-4-2 0-3 0-4 1");
  offset-rotate: 0deg; animation: ask-reading-beads 2600ms linear infinite;
}
.ask-reading-beads .ask-a1-dot:nth-child(1) { animation-delay: 0ms; offset-distance: 0%; }
.ask-reading-beads .ask-a1-dot:nth-child(2) { animation-delay: -867ms; offset-distance: 33.333333%; }
.ask-reading-beads .ask-a1-dot:nth-child(3) { animation-delay: -1733ms; offset-distance: 66.666667%; }
.ask-reading-beads[data-reduced="true"] .ask-a1-dot { animation: none; }
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

/** The TM-1 scatter-to-lasso engine at glyph size; lime only while thinking. */
function AskGlyph({ state }: { state: "thinking" | "settled" }) {
  return (
    <span data-testid="ask-thinking-glyph" data-state={state} className="ask-a1-glyph inline-flex shrink-0" aria-hidden>
      <LassoThinkingMark kind="signature" size={GLYPH_SIZE} thinking={state === "thinking"} rope={state !== "thinking"} />
    </span>
  );
}

export function AskThinkingFoot({ answered, reduced, count, elapsed }: { answered: boolean; reduced: boolean; count: number; elapsed: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground" data-testid="ask-thinking-foot">
      <AskGlyph state={answered ? "settled" : "thinking"} />
      {answered ? null : (
        <span className="ask-reading-beads" data-reduced={reduced} data-testid="ask-thinking-dots" aria-hidden>
          {[0, 1, 2].map((i) => <span key={i} className="ask-a1-dot" />)}
        </span>
      )}
      <span>{answered ? ASK_THINKING_COPY.read(count) : ASK_THINKING_COPY.reading}</span>
      <span className="ml-auto font-mono text-[11px] tabular-nums">{elapsed}</span>
    </div>
  );
}
