import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-motion";

type Placement = "right" | "left" | "above" | "below";
type NotePosition = { left: number; top: number; placement: Placement };

const VIEWPORT_EDGE = 12;
const NOTE_GAP = 12;
const NOTE_HEIGHT = 92;

function candidatePosition(anchor: DOMRect, width: number, placement: Placement): NotePosition {
  if (placement === "right") return { left: anchor.right + NOTE_GAP, top: anchor.top + (anchor.height - NOTE_HEIGHT) / 2, placement };
  if (placement === "left") return { left: anchor.left - width - NOTE_GAP, top: anchor.top + (anchor.height - NOTE_HEIGHT) / 2, placement };
  if (placement === "above") return { left: anchor.left + (anchor.width - width) / 2, top: anchor.top - NOTE_HEIGHT - NOTE_GAP, placement };
  return { left: anchor.left + (anchor.width - width) / 2, top: anchor.bottom + NOTE_GAP, placement };
}

function isInsideViewport(position: NotePosition, width: number): boolean {
  return position.left >= VIEWPORT_EDGE
    && position.top >= VIEWPORT_EDGE
    && position.left + width <= window.innerWidth - VIEWPORT_EDGE
    && position.top + NOTE_HEIGHT <= window.innerHeight - VIEWPORT_EDGE;
}

function isMeaningfulHit(element: Element, anchor: HTMLElement): boolean {
  if (element === anchor || anchor.contains(element)) return false;
  if (element.closest(".demo-tour-note")) return false;
  if (element === document.body || element === document.documentElement) return false;
  const html = element as HTMLElement;
  const style = window.getComputedStyle(html);
  if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") return false;
  if (element.matches("button, a, input, textarea, select, summary, [role='button'], [role='link']")) return true;
  return Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()));
}

function collisionCount(position: NotePosition, width: number, anchor: HTMLElement): number {
  const { left, top } = position;
  const right = left + width;
  const bottom = top + NOTE_HEIGHT;
  const points = [
    [left, top], [left + width / 2, top], [right, top],
    [left, top + NOTE_HEIGHT / 2], [left + width / 2, top + NOTE_HEIGHT / 2], [right, top + NOTE_HEIGHT / 2],
    [left, bottom], [left + width / 2, bottom], [right, bottom],
  ];
  const hits = new Set<Element>();
  for (const [x, y] of points) {
    for (const element of document.elementsFromPoint(x, y)) {
      if (isMeaningfulHit(element, anchor)) hits.add(element);
    }
  }
  return hits.size;
}

export function chooseDemoNotePosition(anchor: HTMLElement, width: number): NotePosition | null {
  const rect = anchor.getBoundingClientRect();
  const verticalOrder: Placement[] = rect.top >= NOTE_HEIGHT + NOTE_GAP + VIEWPORT_EDGE ? ["above", "below"] : ["below", "above"];
  const order: Placement[] = window.innerWidth < 640 ? verticalOrder : ["right", "left", "above", "below"];
  const candidates = order
    .map((placement) => candidatePosition(rect, width, placement))
    .filter((position) => isInsideViewport(position, width))
    .map((position) => ({ position, hits: collisionCount(position, width, anchor) }));
  const clear = candidates.find(({ hits }) => hits === 0);
  if (clear) return clear.position;
  return candidates.sort((a, b) => a.hits - b.hits
    || Number(!["above", "below"].includes(a.position.placement)) - Number(!["above", "below"].includes(b.position.placement)))[0]?.position ?? null;
}

export function DemoTourNote({
  step,
  anchorTestId,
  children,
  onDismiss,
  final = false,
}: {
  step: number;
  anchorTestId: string;
  children: string;
  onDismiss: () => void;
  final?: boolean;
}) {
  const reduced = useReducedMotion();
  const [position, setPosition] = useState<NotePosition | null>(null);

  useLayoutEffect(() => {
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const anchor = document.querySelector<HTMLElement>(`[data-testid="${anchorTestId}"]`);
        if (!anchor) return setPosition(null);
        const width = Math.min(286, window.innerWidth - 24);
        setPosition(chooseDemoNotePosition(anchor, width));
      });
    };
    place();
    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-turn-focus", "aria-expanded"] });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorTestId]);

  useEffect(() => {
    if (!position) return;
    document.querySelector<HTMLElement>(`[data-testid="${anchorTestId}"]`)?.setAttribute("data-demo-tour-anchor", "true");
    return () => document.querySelector<HTMLElement>(`[data-testid="${anchorTestId}"]`)?.removeAttribute("data-demo-tour-anchor");
  }, [anchorTestId, position]);

  if (!position || typeof document === "undefined") return null;
  return createPortal(
    <aside
      data-testid={`demo-tour-note-${step}`}
      data-placement={position.placement}
      data-reduced-motion={reduced ? "true" : "false"}
      className="demo-tour-note"
      style={{ "--demo-note-left": `${position.left}px`, "--demo-note-top": `${position.top}px` } as CSSProperties}
      aria-label={`Demo guide step ${step}`}
    >
      <svg className="demo-tour-note-mark" viewBox="0 0 34 28" aria-hidden>
        <path d="M2 3c8 1 17 5 22 13m0 0-9-2m9 2-3-9" />
      </svg>
      <p>{children}</p>
      <Button type="button" variant="link" className="demo-tour-note-skip" onClick={onDismiss}>
        {final ? "Done" : "Skip the tour"}
      </Button>
    </aside>,
    document.body,
  );
}
