import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";

import {
  LIFT_MORPH_MS,
  liftMoved,
  liftOpenRect,
  liftResized,
  type LiftCorner,
  type LiftRect,
} from "@/lib/lift-view";

export const LIFT_COPY = {
  expand: "Open the full view",
  compress: "Back to the board",
  move: "Move this view",
  resize: (corner: LiftCorner) => `Resize from ${corner}`,
} as const;

const CORNERS: readonly LiftCorner[] = ["nw", "ne", "se", "sw"];

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type Gesture =
  | { kind: "move"; start: LiftRect; x: number; y: number }
  | { kind: "resize"; corner: LiftCorner; start: LiftRect; x: number; y: number };

/**
 * LIFT (behind lift-v1): a piece of work lifted off the board. It morphs out of the card, the board
 * behind dims and blurs, and it can be moved by its header and resized from its corners. Back to the
 * board (or Esc, or a press on the dimmed board) morphs it home. Expand opens the full view.
 *
 * Nothing here writes to the board: a move or a resize lasts until the view closes. It is portalled to
 * the body, and every press, key and wheel inside it stops at its root, so the board behind never pans,
 * draws a box, deletes or zooms because of something done in here.
 */
export function LiftedWork({
  title,
  origin,
  returnFocusTo,
  onClose,
  onExpand,
  children,
}: {
  title: string;
  /** The card's box on screen when it was lifted; the view grows out of it and shrinks back into it. */
  origin: LiftRect | null;
  returnFocusTo?: (() => HTMLElement | null) | undefined;
  onClose: () => void;
  onExpand: (rect: LiftRect) => void;
  children: (bodyWidth: number) => ReactNode;
}) {
  const still = useRef(reducedMotion()).current;
  const target = useRef(liftOpenRect(viewport())).current;
  const [rect, setRect] = useState<LiftRect>(origin && !still ? origin : target);
  const [morphing, setMorphing] = useState(false);
  const [closing, setClosing] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finished = useRef(false);

  // Grow out of the card: start on its box, then move to the default size on the next frame.
  useLayoutEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
    if (!origin || still) return;
    setMorphing(true);
    const frame = requestAnimationFrame(() => setRect(target));
    const done = setTimeout(() => setMorphing(false), LIFT_MORPH_MS + 40);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(done);
    };
  }, [origin, still, target]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
      returnFocusTo?.()?.focus({ preventScroll: true });
    },
    [returnFocusTo],
  );

  function finish(after: () => void) {
    if (finished.current) return;
    finished.current = true;
    after();
  }

  function close() {
    if (closing) return;
    if (!origin || still) {
      finish(onClose);
      return;
    }
    setClosing(true);
    setMorphing(true);
    setRect(origin);
    closeTimer.current = setTimeout(() => finish(onClose), LIFT_MORPH_MS);
  }

  // Esc closes from anywhere while the view is up, before the board's own Esc can clear its selection.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  function beginMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    if ((event.target as Element).closest("button")) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer is already gone */
    }
    gesture.current = { kind: "move", start: rect, x: event.clientX, y: event.clientY };
  }

  function beginResize(corner: LiftCorner, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer is already gone */
    }
    gesture.current = { kind: "resize", corner, start: rect, x: event.clientX, y: event.clientY };
  }

  function onGestureMove(event: ReactPointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    setRect(
      g.kind === "move"
        ? liftMoved(g.start, dx, dy, viewport())
        : liftResized(g.start, g.corner, dx, dy, viewport()),
    );
  }

  function endGesture() {
    gesture.current = null;
  }

  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return createPortal(
    <div
      className="lift-layer"
      data-testid="lift-layer"
      data-closing={closing ? "true" : undefined}
      onPointerDown={stop}
      onPointerUp={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
      onWheel={stop}
      onKeyDown={stop}
      onKeyUp={stop}
    >
      <div
        className="lift-backdrop"
        data-testid="lift-backdrop"
        aria-hidden="true"
        onPointerDown={(event) => {
          if (event.button === 0) close();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="lift-panel"
        data-testid="lift-panel"
        data-morphing={morphing ? "true" : undefined}
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          transitionDuration: `${LIFT_MORPH_MS}ms`,
        }}
      >
        <header
          className="lift-head"
          aria-label={LIFT_COPY.move}
          onPointerDown={beginMove}
          onPointerMove={onGestureMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
        >
          <span className="lift-title">{title}</span>
          <button
            type="button"
            className="lift-icon"
            aria-label={LIFT_COPY.expand}
            title={LIFT_COPY.expand}
            onClick={() => finish(() => onExpand(rect))}
          >
            <Maximize2 size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lift-icon"
            aria-label={LIFT_COPY.compress}
            title={LIFT_COPY.compress}
            onClick={close}
          >
            <Minimize2 size={15} aria-hidden="true" />
          </button>
        </header>
        <div className="lift-body" data-testid="lift-body">
          {children(rect.width)}
        </div>
        {CORNERS.map((corner) => (
          <span
            key={corner}
            aria-hidden="true"
            className="lift-corner"
            data-corner={corner}
            title={LIFT_COPY.resize(corner)}
            onPointerDown={(event) => beginResize(corner, event)}
            onPointerMove={onGestureMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
