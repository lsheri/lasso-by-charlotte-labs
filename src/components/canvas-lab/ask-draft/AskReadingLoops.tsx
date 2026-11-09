import { useEffect, useRef, type RefObject } from "react";

import { isOffStage, loopPath, offStageLine, phaseAt, takeLift, type StageBox } from "@/lib/ask-reading-clock";

const MAX_LOOPS = 12;
export const LIFT_MS = 700;

/** V2-3 keyframes live with the component, never in the global stylesheet. */
export const ASK_READING_LOOPS_STYLES = `
.ask-reading-loops { position: absolute; inset: 0; z-index: 28; width: 100%; height: 100%; overflow: hidden; pointer-events: none; }
.ask-reading-loops path { fill: none; stroke: color-mix(in srgb, var(--nb-graphite) 42%, transparent); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
.ask-reading-loops circle { fill: var(--ask-live); }
.ask-reading-offstage { position: absolute; z-index: 29; pointer-events: none; padding: 2px 8px; border-radius: var(--radius-pill); background: var(--nb-white); border: 1px solid var(--border); font-size: 11px; line-height: 16px; color: var(--muted-foreground); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .ask-reading-loops circle { display: none; } }
`;

/** The lift outlives the loops (it runs as they leave), so its style is mounted by the Ask surface, not here. */
export const ASK_LIFT_STYLES = `
@keyframes ask-lift { 0% { translate: 0 0; } 35% { translate: 0 -4px; } 100% { translate: 0 0; } }
[data-node-id][data-ask-lift="on"] { animation: ask-lift ${LIFT_MS}ms ease-out 1; }
@media (prefers-reduced-motion: reduce) { [data-node-id][data-ask-lift="on"] { animation: none !important; } }
`;

function toStage(box: DOMRect, host: DOMRect): StageBox {
  return { left: box.left - host.left, top: box.top - host.top, right: box.right - host.left, bottom: box.bottom - host.top };
}

function cardFor(host: HTMLElement, id: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]:not([data-side])`);
}

/**
 * V2-3 (ask-v2): a loop drawn around every card Lasso is reading, with a lime
 * light travelling each loop. Cards outside the visible board are counted, not
 * drawn. Keyed to data-node-id and anchored to the turn's start, so a live
 * redraw (cards replaced, this component remounted) resumes the motion.
 * Decoration only: one frame loop writing attributes, never React state per
 * frame, and nothing that could hold the board's redraw.
 */
export function AskReadingLoops({ host, surfaceRef, nodeIds, turnKey, onShowing }: { host: HTMLElement; surfaceRef: RefObject<HTMLElement | null>; nodeIds: string[]; turnKey: string; onShowing?: (showing: boolean) => void }) {
  const ids = nodeIds.slice(0, MAX_LOOPS);
  const idsKey = ids.join("|");
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const beads = useRef<(SVGCircleElement | null)[]>([]);
  const pill = useRef<HTMLSpanElement | null>(null);
  const extra = Math.max(0, nodeIds.length - ids.length);
  useEffect(() => {
    const list = idsKey ? idsKey.split("|") : [];
    let reduced = false;
    try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { reduced = false; }
    let raf = 0;
    let showing: boolean | null = null;
    const frame = (now: number) => {
      const hostBox = host.getBoundingClientRect();
      const stage: StageBox = { left: 0, top: 0, right: hostBox.width, bottom: hostBox.height };
      let drawn = 0;
      let off = extra;
      list.forEach((id, index) => {
        const path = paths.current[index];
        const bead = beads.current[index];
        if (!path) return;
        const card = cardFor(host, id);
        const box = card ? toStage(card.getBoundingClientRect(), hostBox) : null;
        if (!box || isOffStage(box, stage)) {
          off += 1;
          path.setAttribute("d", "");
          bead?.setAttribute("r", "0");
          return;
        }
        drawn += 1;
        path.setAttribute("d", loopPath(box));
        if (bead && !reduced && typeof path.getPointAtLength === "function") {
          const t = phaseAt(turnKey, now, index / Math.max(1, list.length));
          const at = path.getPointAtLength(path.getTotalLength() * t);
          bead.setAttribute("cx", String(at.x));
          bead.setAttribute("cy", String(at.y));
          bead.setAttribute("r", "3");
        }
      });
      const label = offStageLine(off);
      const el = pill.current;
      const surface = surfaceRef.current;
      if (el) {
        el.textContent = label ?? "";
        el.style.display = label ? "" : "none";
        if (label && surface) {
          const s = toStage(surface.getBoundingClientRect(), hostBox);
          el.style.left = `${Math.max(8, s.left)}px`;
          el.style.top = `${Math.max(8, s.top - 26)}px`;
        }
      }
      const next = drawn > 0 || off > 0;
      if (next !== showing) { showing = next; onShowing?.(next); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); onShowing?.(false); };
  }, [host, surfaceRef, idsKey, turnKey, extra, onShowing]);
  return (
    <>
      <style>{ASK_READING_LOOPS_STYLES}</style>
      <svg className="ask-reading-loops" aria-hidden="true" data-testid="ask-reading-loops">
        {ids.map((id, index) => (
          <g key={id} data-loop-for={id}>
            <path ref={(el) => { paths.current[index] = el; }} />
            <circle ref={(el) => { beads.current[index] = el; }} r="0" />
          </g>
        ))}
      </svg>
      <span ref={pill} className="ask-reading-offstage" data-testid="ask-reading-offstage" style={{ display: "none" }} />
    </>
  );
}

/**
 * Lift on done: when a turn finishes without an error, every card it read
 * rises once. takeLift keeps it to once per card per turn, whatever re-renders.
 */
export function useAskLift({ host, nodeIds, pending, error, turnKey }: { host: HTMLElement | null; nodeIds: string[]; pending: boolean; error: boolean; turnKey: string }) {
  const wasPending = useRef(pending);
  // V2-3b: Ask clears the question in the same render the answer lands, so the key at that moment is blank
  // for every turn. Hold the key the turn was asked under, or only the first turn on a page ever lifts.
  const askedKey = useRef(turnKey);
  if (pending) askedKey.current = turnKey;
  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished || error || !host) return;
    const key = askedKey.current;
    const cards: HTMLElement[] = [];
    for (const id of nodeIds) {
      if (!takeLift(key, id)) continue;
      const card = cardFor(host, id);
      if (!card) continue;
      card.setAttribute("data-ask-lift", "on");
      cards.push(card);
    }
    const timer = window.setTimeout(() => { for (const card of cards) card.removeAttribute("data-ask-lift"); }, LIFT_MS);
    return () => { window.clearTimeout(timer); for (const card of cards) card.removeAttribute("data-ask-lift"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);
}
