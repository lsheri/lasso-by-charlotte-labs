import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The engagement panel's width, dragged from its inner edge.
 *
 * Below the minimum the chat composer and the notecard chips stop fitting;
 * above the maximum the work column stops being the main thing. Both limits
 * are enforced on every move, not only on release, so the edge stops dead.
 */
export const PANEL_MIN_WIDTH = 320;
export const PANEL_MAX_WIDTH = 640;
export const PANEL_DEFAULT_WIDTH = 380;
export const PANEL_MAX_FRACTION = 0.46;
export const PANEL_WIDTH_KEY = "lasso.engagement.panel-width";

/** A raw pixel width is a fingerprinting surface for no gain, so it is banded. */
export function panelWidthBucket(width: number): "320-400" | "400-500" | "500-640" {
  if (width < 400) return "320-400";
  if (width < 500) return "400-500";
  return "500-640";
}

/**
 * A wrapper narrower than this cannot be a real bench page, so it is a
 * measurement taken before layout settled. In that case the page ceiling is
 * unknown and only the absolute maximum applies, otherwise a restored width
 * collapses to the minimum on the first paint.
 */
const WRAPPER_MEASURED_MIN = 480;

export function clampPanelWidth(width: number, wrapperWidth: number): number {
  const measured = wrapperWidth >= WRAPPER_MEASURED_MIN;
  const fromPage = measured ? wrapperWidth * PANEL_MAX_FRACTION : PANEL_MAX_WIDTH;
  const max = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, Math.round(fromPage)));
  if (!Number.isFinite(width)) return Math.min(PANEL_DEFAULT_WIDTH, max);
  return Math.min(max, Math.max(PANEL_MIN_WIDTH, Math.round(width)));
}


function readStored(): number | null {
  try {
    const raw = window.localStorage.getItem(PANEL_WIDTH_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    // A private window that refuses site data still gets a working handle.
    return null;
  }
}

function writeStored(width: number): void {
  try {
    window.localStorage.setItem(PANEL_WIDTH_KEY, String(width));
  } catch {
    /* a resize handle must never be what breaks the page */
  }
}

export function usePanelWidth(wrapperRef: React.RefObject<HTMLElement | null>, options?: {
  onResizeEnd?: (width: number) => void;
}) {
  const [width, setWidthState] = useState(PANEL_DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(width);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const onResizeEnd = options?.onResizeEnd;

  const wrapperWidth = useCallback(
    () => wrapperRef.current?.getBoundingClientRect().width ?? 0,
    [wrapperRef],
  );

  const maxWidth = clampPanelWidth(PANEL_MAX_WIDTH, wrapperWidth());

  const apply = useCallback(
    (next: number) => {
      const clamped = clampPanelWidth(next, wrapperWidth());
      widthRef.current = clamped;
      setWidthState(clamped);
      return clamped;
    },
    [wrapperWidth],
  );

  // Restore on mount. The wrapper often has no real width yet, so this may be
  // left unclamped on purpose and is re-clamped by the observer below.
  useEffect(() => {
    const stored = readStored();
    if (stored !== null) apply(stored);
  }, [apply]);

  // The first real measurement, and every later one, decides the ceiling. A
  // panel sized on a wide screen must not exceed the maximum on a narrow one.
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => apply(widthRef.current));
    observer.observe(node);
    return () => observer.disconnect();
  }, [apply, wrapperRef]);

  useEffect(() => {
    const onResize = () => apply(widthRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [apply]);


  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    document.body.style.userSelect = "";
    writeStored(widthRef.current);
    onResizeEnd?.(widthRef.current);
  }, [onResizeEnd]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    dragRef.current = { startX: event.clientX, startWidth: widthRef.current };
    setDragging(true);
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      // Dragging left makes the panel wider.
      apply(drag.startWidth + (drag.startX - event.clientX));
    },
    [apply],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      endDrag();
    },
    [endDrag],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      let next: number | null = null;
      if (event.key === "ArrowLeft") next = widthRef.current + 16;
      else if (event.key === "ArrowRight") next = widthRef.current - 16;
      else if (event.key === "Home") next = PANEL_MIN_WIDTH;
      else if (event.key === "End") next = PANEL_MAX_WIDTH;
      if (next === null) return;
      event.preventDefault();
      const applied = apply(next);
      writeStored(applied);
      onResizeEnd?.(applied);
    },
    [apply, onResizeEnd],
  );

  return {
    width,
    dragging,
    maxWidth,
    handleProps: {
      role: "separator" as const,
      "aria-orientation": "vertical" as const,
      "aria-label": "Resize the panel",
      "aria-valuenow": width,
      "aria-valuemin": PANEL_MIN_WIDTH,
      "aria-valuemax": maxWidth,
      tabIndex: 0,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onKeyDown,
    },
  };
}
