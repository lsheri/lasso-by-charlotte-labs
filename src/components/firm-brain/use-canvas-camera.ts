import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { easeFlow, moveDuration, type CanvasRect } from "@/lib/firm-canvas-shared";

export type Camera = { x: number; y: number; k: number };

export const MIN_ZOOM = 0.12;
export const MAX_ZOOM = 2.2;
const clampK = (k: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, k));

/** The part of the stage the map may use: below the title, above the floating question. */
export type Insets = { top: number; bottom: number; left: number; right: number };

/**
 * The canvas camera: one transform on the world element, written straight to the DOM so a drag never re-renders
 * React. The visible rectangle (for culling) is published at most once a frame. Drag pans, two fingers pan and pinch,
 * a wheel or trackpad scroll pans, ctrl or cmd with the wheel (a trackpad pinch) zooms at the pointer.
 */
export function useCanvasCamera({
  stage,
  world,
  insets,
  reduceMotion,
}: {
  stage: RefObject<HTMLDivElement | null>;
  world: RefObject<HTMLDivElement | null>;
  insets: Insets;
  reduceMotion: boolean;
}) {
  const cam = useRef<Camera>({ x: 0, y: 0, k: 1 });
  const [view, setView] = useState<CanvasRect>({ x: 0, y: 0, w: 1600, h: 1000 });
  const frame = useRef<number | null>(null);
  const move = useRef<number | null>(null);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;

  const publish = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const el = stage.current;
      if (!el) return;
      const { x, y, k } = cam.current;
      setView({ x: -x / k, y: -y / k, w: el.clientWidth / k, h: el.clientHeight / k });
    });
  }, [stage]);

  const apply = useCallback(() => {
    const { x, y, k } = cam.current;
    if (world.current) world.current.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    publish();
  }, [world, publish]);

  const stop = () => {
    if (move.current !== null) cancelAnimationFrame(move.current);
    move.current = null;
  };

  /** Moves the camera so world point (cx, cy) sits in the middle of the free area at zoom k. */
  const flyTo = useCallback(
    (cx: number, cy: number, k: number): Promise<void> => {
      const el = stage.current;
      if (!el) return Promise.resolve();
      const i = insetsRef.current;
      const target = clampK(k);
      const tx = i.left + (el.clientWidth - i.left - i.right) / 2 - cx * target;
      const ty = i.top + (el.clientHeight - i.top - i.bottom) / 2 - cy * target;
      stop();
      const from = { ...cam.current };
      if (reduceMotion) {
        cam.current = { x: tx, y: ty, k: target };
        apply();
        return Promise.resolve();
      }
      const ms = moveDuration(
        Math.hypot(tx - from.x, ty - from.y) + Math.abs(target - from.k) * 600,
      );
      const start = performance.now();
      return new Promise((resolve) => {
        const step = (now: number) => {
          const t = easeFlow(Math.min(1, (now - start) / ms));
          cam.current = {
            x: from.x + (tx - from.x) * t,
            y: from.y + (ty - from.y) * t,
            k: from.k + (target - from.k) * t,
          };
          apply();
          if (t < 1) move.current = requestAnimationFrame(step);
          else {
            move.current = null;
            resolve();
          }
        };
        move.current = requestAnimationFrame(step);
      });
    },
    [stage, apply, reduceMotion],
  );

  /** The zoom that fits a world rectangle into the free area, capped at maxK. */
  const fitZoom = useCallback(
    (box: CanvasRect, maxK = 1): number => {
      const el = stage.current;
      if (!el) return 1;
      const i = insetsRef.current;
      const w = Math.max(80, el.clientWidth - i.left - i.right - 32);
      const h = Math.max(80, el.clientHeight - i.top - i.bottom - 16);
      return clampK(Math.min(w / Math.max(1, box.w), h / Math.max(1, box.h), maxK));
    },
    [stage],
  );

  const fit = useCallback(
    (box: CanvasRect, maxK = 1, instant = false) => {
      const k = fitZoom(box, maxK);
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      if (!instant) return flyTo(cx, cy, k);
      const el = stage.current;
      if (!el) return Promise.resolve();
      const i = insetsRef.current;
      stop();
      cam.current = {
        k,
        x: i.left + (el.clientWidth - i.left - i.right) / 2 - cx * k,
        y: i.top + (el.clientHeight - i.top - i.bottom) / 2 - cy * k,
      };
      apply();
      return Promise.resolve();
    },
    [fitZoom, flyTo, stage, apply],
  );

  const zoomAt = useCallback(
    (factor: number, px?: number, py?: number) => {
      const el = stage.current;
      if (!el) return;
      const sx = px ?? el.clientWidth / 2;
      const sy = py ?? el.clientHeight / 2;
      const { x, y, k } = cam.current;
      const next = clampK(k * factor);
      const wx = (sx - x) / k;
      const wy = (sy - y) / k;
      stop();
      cam.current = { k: next, x: sx - wx * next, y: sy - wy * next };
      apply();
    },
    [stage, apply],
  );

  /** World point under a screen point inside the stage. */
  const toWorld = useCallback((sx: number, sy: number) => {
    const { x, y, k } = cam.current;
    return { x: (sx - x) / k, y: (sy - y) / k };
  }, []);

  // Pointer, wheel and pinch.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pan: { x: number; y: number; cx: number; cy: number } | null = null;
    let pinch: { d: number; k: number; wx: number; wy: number } | null = null;
    const local = (p: { x: number; y: number }) => {
      const r = el.getBoundingClientRect();
      return { x: p.x - r.left, y: p.y - r.top };
    };
    const down = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("button, a, input, textarea, [data-canvas-no-pan]"))
        return;
      el.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      stop();
      if (pointers.size === 1)
        pan = { x: event.clientX, y: event.clientY, cx: cam.current.x, cy: cam.current.y };
      else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [
          { x: number; y: number },
          { x: number; y: number },
        ];
        const mid = local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        pinch = {
          d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          k: cam.current.k,
          wx: (mid.x - cam.current.x) / cam.current.k,
          wy: (mid.y - cam.current.y) / cam.current.k,
        };
        pan = null;
      }
      el.dataset["dragging"] = "true";
    };
    const moveHandler = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [
          { x: number; y: number },
          { x: number; y: number },
        ];
        const mid = local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        const k = clampK((pinch.k * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d);
        cam.current = { k, x: mid.x - pinch.wx * k, y: mid.y - pinch.wy * k };
        apply();
      } else if (pan) {
        cam.current = {
          ...cam.current,
          x: pan.cx + event.clientX - pan.x,
          y: pan.cy + event.clientY - pan.y,
        };
        apply();
      }
    };
    const up = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 1) {
        const [p] = [...pointers.values()] as [{ x: number; y: number }];
        pan = { x: p.x, y: p.y, cx: cam.current.x, cy: cam.current.y };
      }
      if (pointers.size === 0) {
        pan = null;
        delete el.dataset["dragging"];
      }
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const p = local({ x: event.clientX, y: event.clientY });
        zoomAt(Math.exp(-event.deltaY * 0.01), p.x, p.y);
      } else {
        stop();
        cam.current = {
          ...cam.current,
          x: cam.current.x - event.deltaX,
          y: cam.current.y - event.deltaY,
        };
        apply();
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", moveHandler);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", moveHandler);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [stage, apply, zoomAt]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      stop();
    },
    [],
  );

  return { cam, view, flyTo, fit, fitZoom, zoomAt, toWorld, apply };
}
