import { useEffect, useRef, type RefObject } from "react";
import { readingLinePath, type Box } from "@/lib/ask-reading-lines";

const MAX_LINES = 6;
const CYCLE_MS = 2600;

function toStage(box: DOMRect, host: DOMRect): Box {
  return { left: box.left - host.left, top: box.top - host.top, right: box.right - host.left, bottom: box.bottom - host.top };
}

/** ASK-LOOK-1: the cards Lasso is reading, drawn into Ask while it reads. One frame loop, writing attributes directly so the page never re-renders per frame. */
export function AskReadingLines({ host, surfaceRef, nodeIds, onShowing }: { host: HTMLElement; surfaceRef: RefObject<HTMLElement | null>; nodeIds: string[]; onShowing: (showing: boolean) => void }) {
  const ids = nodeIds.slice(0, MAX_LINES);
  const idsKey = ids.join("|");
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const beads = useRef<(SVGCircleElement | null)[]>([]);
  useEffect(() => {
    const list = idsKey ? idsKey.split("|") : [];
    let reduced = false;
    try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { reduced = false; }
    let raf = 0;
    let showing: boolean | null = null;
    const begun = performance.now();
    const frame = (now: number) => {
      const surface = surfaceRef.current;
      if (surface) {
        const hostBox = host.getBoundingClientRect();
        const ask = toStage(surface.getBoundingClientRect(), hostBox);
        const stage: Box = { left: 0, top: 0, right: hostBox.width, bottom: hostBox.height };
        let drawn = 0;
        list.forEach((id, index) => {
          const path = paths.current[index];
          const bead = beads.current[index];
          if (!path) return;
          const card = host.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]:not([data-side])`);
          const d = card ? readingLinePath(toStage(card.getBoundingClientRect(), hostBox), ask, stage) : null;
          if (!d) { path.setAttribute("d", ""); bead?.setAttribute("r", "0"); return; }
          drawn += 1;
          path.setAttribute("d", d);
          if (bead && !reduced && typeof path.getPointAtLength === "function") {
            const t = (((now - begun) / CYCLE_MS) + index / list.length) % 1;
            const eased = t * t * (3 - 2 * t);
            const at = path.getPointAtLength(path.getTotalLength() * eased);
            bead.setAttribute("cx", String(at.x));
            bead.setAttribute("cy", String(at.y));
            bead.setAttribute("r", "3.5");
          }
        });
        const next = drawn > 0;
        if (next !== showing) { showing = next; onShowing(next); }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); onShowing(false); };
  }, [host, surfaceRef, idsKey, onShowing]);
  return (
    <svg className="ask-reading-lines" aria-hidden="true">
      {ids.map((id, index) => (
        <g key={id}>
          <path ref={(el) => { paths.current[index] = el; }} />
          <circle ref={(el) => { beads.current[index] = el; }} r="0" />
        </g>
      ))}
    </svg>
  );
}
