import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-motion";

type Placement = "right" | "left" | "above" | "below";
type NotePosition = { left: number; top: number; width: number; placement: Placement; hits: number };
type PositionCandidate = Omit<NotePosition, "hits">;

const VIEWPORT_EDGE = 12;
const NOTE_GAP = 12;
const NOTE_HEIGHT = 92;
const NOTE_MIN_WIDTH = 200;

function rectFromEdges(left: number, top: number, right: number, bottom: number): DOMRect {
  return { left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) };
}

function visibleContentRect(anchor: HTMLElement): DOMRect {
  const rects: DOMRect[] = [];
  const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width > 0 && rect.height > 0) rects.push(rect);
      }
      range.detach();
    }
    node = walker.nextNode();
  }
  for (const inline of anchor.querySelectorAll<HTMLElement>("svg, img, [data-demo-tour-inline-icon]")) {
    const rect = inline.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) rects.push(rect);
  }
  if (rects.length === 0) return anchor.getBoundingClientRect();
  return rectFromEdges(
    Math.min(...rects.map((rect) => rect.left)),
    Math.min(...rects.map((rect) => rect.top)),
    Math.max(...rects.map((rect) => rect.right)),
    Math.max(...rects.map((rect) => rect.bottom)),
  );
}

function candidatePositions(anchor: DOMRect, requestedWidth: number, placement: Placement): PositionCandidate[] {
  if (placement === "right") {
    const width = Math.min(requestedWidth, window.innerWidth - VIEWPORT_EDGE - anchor.right - NOTE_GAP);
    return width < NOTE_MIN_WIDTH ? [] : [{ left: anchor.right + NOTE_GAP, top: anchor.top + (anchor.height - NOTE_HEIGHT) / 2, width, placement }];
  }
  if (placement === "left") {
    const width = Math.min(requestedWidth, anchor.left - NOTE_GAP - VIEWPORT_EDGE);
    return width < NOTE_MIN_WIDTH ? [] : [{ left: anchor.left - width - NOTE_GAP, top: anchor.top + (anchor.height - NOTE_HEIGHT) / 2, width, placement }];
  }
  const top = placement === "above" ? anchor.top - NOTE_HEIGHT - NOTE_GAP : anchor.bottom + NOTE_GAP;
  const width = requestedWidth;
  const centered = anchor.left + (anchor.width - width) / 2;
  const positions = [centered, anchor.left, anchor.right - width]
    .map((left) => Math.max(VIEWPORT_EDGE, Math.min(left, window.innerWidth - VIEWPORT_EDGE - width)));
  return [...new Set(positions)].map((left) => ({ left, top, width, placement }));
}

function isInsideViewport(position: PositionCandidate): boolean {
  return position.left >= VIEWPORT_EDGE
    && position.top >= VIEWPORT_EDGE
    && position.left + position.width <= window.innerWidth - VIEWPORT_EDGE
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

function collisionCount(position: PositionCandidate, anchor: HTMLElement): number {
  const { left, top } = position;
  const right = left + position.width;
  const bottom = top + NOTE_HEIGHT;
  const points: Array<[number, number]> = [
    [left, top], [left + position.width / 2, top], [right, top],
    [left, top + NOTE_HEIGHT / 2], [left + position.width / 2, top + NOTE_HEIGHT / 2], [right, top + NOTE_HEIGHT / 2],
    [left, bottom], [left + position.width / 2, bottom], [right, bottom],
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
  const rect = visibleContentRect(anchor);
  const verticalOrder: Placement[] = rect.top >= NOTE_HEIGHT + NOTE_GAP + VIEWPORT_EDGE ? ["above", "below"] : ["below", "above"];
  const order: Placement[] = window.innerWidth < 640 ? verticalOrder : ["right", "left", "above", "below"];
  const candidates = order
    .flatMap((placement) => candidatePositions(rect, width, placement))
    .filter(isInsideViewport)
    .map((position) => ({ ...position, hits: collisionCount(position, anchor) }));
  const clear = candidates.find(({ hits }) => hits === 0);
  if (clear) return clear;
  return candidates.sort((a, b) => a.hits - b.hits
    || Number(!["above", "below"].includes(a.placement)) - Number(!["above", "below"].includes(b.placement)))[0] ?? null;
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
      data-collision-count={position.hits}
      data-reduced-motion={reduced ? "true" : "false"}
      className="demo-tour-note"
      style={{
        "--demo-note-left": `${position.left}px`,
        "--demo-note-top": `${position.top}px`,
        "--demo-note-width": `${position.width}px`,
      } as CSSProperties}
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
