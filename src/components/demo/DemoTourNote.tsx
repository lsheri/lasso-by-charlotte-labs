import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-motion";

type Placement = "right" | "left" | "above" | "below" | "dock";
type NotePosition = { left: number; top: number; width: number; placement: Placement; arrowOffset: number; hits: number };
type PositionCandidate = Omit<NotePosition, "hits">;

const VIEWPORT_EDGE = 12;
const NOTE_GAP = 12;
const NOTE_HEIGHT = 92;
const NOTE_MIN_WIDTH = 200;
const MOBILE_BREAKPOINT = 640;
const SAMPLE_GAP = 40;

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
  if (placement === "dock") {
    return [{
      left: VIEWPORT_EDGE,
      top: window.innerHeight - NOTE_HEIGHT - VIEWPORT_EDGE,
      width: window.innerWidth - VIEWPORT_EDGE * 2,
      placement,
      arrowOffset: Math.max(18, Math.min(anchor.left + anchor.width / 2 - VIEWPORT_EDGE - 15, window.innerWidth - VIEWPORT_EDGE * 2 - 48)),
    }];
  }
  if (placement === "right") {
    const width = Math.min(requestedWidth, window.innerWidth - VIEWPORT_EDGE - anchor.right - NOTE_GAP);
    if (width < NOTE_MIN_WIDTH) return [];
    const centered = anchor.top + (anchor.height - NOTE_HEIGHT) / 2;
    const tops = [centered, anchor.bottom - NOTE_HEIGHT, anchor.top]
      .map((top) => Math.max(VIEWPORT_EDGE, Math.min(top, window.innerHeight - VIEWPORT_EDGE - NOTE_HEIGHT)));
    return [...new Set(tops)].map((top) => ({
      left: anchor.right + NOTE_GAP,
      top,
      width,
      placement,
      arrowOffset: Math.max(12, Math.min(anchor.top + anchor.height / 2 - top - 12, NOTE_HEIGHT - 36)),
    }));
  }
  if (placement === "left") {
    const width = Math.min(requestedWidth, anchor.left - NOTE_GAP - VIEWPORT_EDGE);
    if (width < NOTE_MIN_WIDTH) return [];
    const centered = anchor.top + (anchor.height - NOTE_HEIGHT) / 2;
    const tops = [centered, anchor.bottom - NOTE_HEIGHT, anchor.top]
      .map((top) => Math.max(VIEWPORT_EDGE, Math.min(top, window.innerHeight - VIEWPORT_EDGE - NOTE_HEIGHT)));
    return [...new Set(tops)].map((top) => ({
      left: anchor.left - width - NOTE_GAP,
      top,
      width,
      placement,
      arrowOffset: Math.max(12, Math.min(anchor.top + anchor.height / 2 - top - 12, NOTE_HEIGHT - 36)),
    }));
  }
  const top = placement === "above" ? anchor.top - NOTE_HEIGHT - NOTE_GAP : anchor.bottom + NOTE_GAP;
  const width = requestedWidth;
  const centered = anchor.left + (anchor.width - width) / 2;
  const positions = [centered, anchor.left, anchor.right - width]
    .map((left) => Math.max(VIEWPORT_EDGE, Math.min(left, window.innerWidth - VIEWPORT_EDGE - width)));
  return [...new Set(positions)].map((left) => ({ left, top, width, placement, arrowOffset: 0 }));
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

function densePoints(position: PositionCandidate): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const right = position.left + position.width;
  const bottom = position.top + NOTE_HEIGHT;
  for (let x = position.left; x < right; x += SAMPLE_GAP) {
    for (let y = position.top; y < bottom; y += SAMPLE_GAP) points.push([x, y]);
    points.push([x, bottom]);
  }
  for (let y = position.top; y < bottom; y += SAMPLE_GAP) points.push([right, y]);
  points.push([right, bottom]);
  return points;
}

function rectsIntersect(position: PositionCandidate, rect: DOMRect): boolean {
  return position.left < rect.right
    && position.left + position.width > rect.left
    && position.top < rect.bottom
    && position.top + NOTE_HEIGHT > rect.top;
}

function visibleCollisionBars(anchor: HTMLElement): Element[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-demo-tour-collision-bar], body *")).filter((element) => {
    if (element === anchor || anchor.contains(element) || element.closest(".demo-tour-note")) return false;
    const style = window.getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return false;
    const rect = element.getBoundingClientRect();
    const explicit = element.hasAttribute("data-demo-tour-collision-bar");
    const viewportBar = (style.position === "fixed" || style.position === "sticky")
      && rect.width >= window.innerWidth * 0.4
      && rect.height <= 200;
    return (explicit || viewportBar) && rect.width > 0 && rect.height > 0;
  });
}

function collisionCount(position: PositionCandidate, anchor: HTMLElement): number {
  const hits = new Set<Element>();
  for (const [x, y] of densePoints(position)) {
    for (const element of document.elementsFromPoint(x, y)) {
      if (isMeaningfulHit(element, anchor)) hits.add(element);
    }
  }
  for (const bar of visibleCollisionBars(anchor)) {
    if (rectsIntersect(position, bar.getBoundingClientRect())) hits.add(bar);
  }
  return hits.size;
}

export function chooseDemoNotePosition(anchor: HTMLElement, width: number): NotePosition | null {
  const rect = visibleContentRect(anchor);
  if (window.innerWidth < MOBILE_BREAKPOINT) return { ...candidatePositions(rect, width, "dock")[0], hits: 0 };
  const order: Placement[] = ["right", "left", "above", "below"];
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
  const noteRef = useRef<HTMLElement | null>(null);

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

  useLayoutEffect(() => {
    if (position?.placement !== "dock") return;
    const root = document.documentElement;
    const note = noteRef.current;
    const anchor = document.querySelector<HTMLElement>(`[data-testid="${anchorTestId}"]`);
    if (!note || !anchor) return;
    const setClearance = () => root.style.setProperty("--demo-tour-clearance", `${note.getBoundingClientRect().height + VIEWPORT_EDGE}px`);
    root.setAttribute("data-demo-tour-docked", "true");
    setClearance();
    anchor.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(setClearance);
    observer?.observe(note);
    return () => {
      observer?.disconnect();
      root.removeAttribute("data-demo-tour-docked");
      root.style.removeProperty("--demo-tour-clearance");
    };
  }, [anchorTestId, position?.placement, reduced]);

  useEffect(() => {
    if (!position) return;
    document.querySelector<HTMLElement>(`[data-testid="${anchorTestId}"]`)?.setAttribute("data-demo-tour-anchor", "true");
    return () => document.querySelector<HTMLElement>(`[data-testid="${anchorTestId}"]`)?.removeAttribute("data-demo-tour-anchor");
  }, [anchorTestId, position]);

  if (!position || typeof document === "undefined") return null;
  return createPortal(
    <aside
      ref={noteRef}
      data-testid={`demo-tour-note-${step}`}
      data-placement={position.placement}
      data-collision-count={position.hits}
      data-reduced-motion={reduced ? "true" : "false"}
      className="demo-tour-note"
      style={{
        "--demo-note-left": `${position.left}px`,
        "--demo-note-top": `${position.top}px`,
        "--demo-note-width": `${position.width}px`,
        "--demo-note-arrow-offset": `${position.arrowOffset}px`,
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
