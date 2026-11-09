import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  File,
  FileText,
  Image,
  Mail,
  Maximize2,
  MessageSquare,
  MessagesSquare,
  Minimize2,
  Phone,
  Presentation,
  Table2,
  Video,
  type LucideIcon,
} from "lucide-react";

import {
  LIFT_MORPH_MS,
  liftFlip,
  liftMoved,
  liftOpenRect,
  liftResized,
  type LiftCorner,
  type LiftKind,
  type LiftRect,
} from "@/lib/lift-view";

export const LIFT_COPY = {
  expand: "Open the full view",
  compress: "Back to the board",
  move: "Move this view",
  resize: (corner: LiftCorner) => `Resize from ${corner}`,
} as const;

const CORNERS: readonly LiftCorner[] = ["nw", "ne", "se", "sw"];

/** LIFT-6: one header for every kind; only the icon says what it is. */
export const LIFT_KIND_ICON: Record<LiftKind, LucideIcon> = {
  chat: MessageSquare,
  document: FileText,
  deck: Presentation,
  sheet: Table2,
  call: Phone,
  email: Mail,
  message: MessagesSquare,
  image: Image,
  video: Video,
  other: File,
};

/** from: sitting on the card's box. open: at its own box. closing: shrinking back into the card. */
type LiftPhase = "from" | "open" | "closing";

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
 * board (or Esc, or a press on the dimmed board) morphs it home. Expand opens the full view, where the
 * work has one.
 *
 * LIFT-6: one view for every kind of work and for images, so the frame, the size, the corners and the
 * motion never change with what is inside. The morph is a transform: the view is laid out once at its
 * own box and starts scaled onto the card's box, so nothing inside reflows while it moves, and a 40-page
 * PDF morphs as smoothly as a note. The content fades in once the box is on its way.
 *
 * Nothing here writes to the board: a move or a resize lasts until the view closes. It is portalled to
 * the body, and every press, key and wheel inside it stops at its root, so the board behind never pans,
 * draws a box, deletes or zooms because of something done in here.
 */
export function LiftedWork({
  title,
  kind,
  origin,
  returnFocusTo,
  onClose,
  onExpand,
  children,
}: {
  title: string;
  kind: LiftKind;
  /** The card's box on screen when it was lifted; the view grows out of it and shrinks back into it. */
  origin: LiftRect | null;
  returnFocusTo?: (() => HTMLElement | null) | undefined;
  onClose: () => void;
  /** Absent when there is no fuller view to open (an image): the Expand button is not drawn. */
  onExpand?: ((rect: LiftRect) => void) | undefined;
  children: (bodyWidth: number) => ReactNode;
}) {
  const still = useRef(reducedMotion()).current;
  const animate = Boolean(origin) && !still;
  const [rect, setRect] = useState<LiftRect>(() => liftOpenRect(viewport()));
  const [phase, setPhase] = useState<LiftPhase>(animate ? "from" : "open");
  const gesture = useRef<Gesture | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finished = useRef(false);
  const Icon = LIFT_KIND_ICON[kind];

  // Grow out of the card: the first paint sits on the card's box; the next frame lets it go.
  useLayoutEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
    if (!animate) return;
    panelRef.current?.getBoundingClientRect();
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase((current) => (current === "from" ? "open" : current)));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
    // Once, on lift. The view's own box changes only by hand after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (phase === "closing") return;
    if (!animate) {
      finish(onClose);
      return;
    }
    setPhase("closing");
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
      data-closing={phase === "closing" ? "true" : undefined}
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
        data-phase={phase}
        data-kind={kind}
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          transform: phase !== "open" && origin ? liftFlip(origin, rect) : undefined,
          transitionDuration: animate ? `${LIFT_MORPH_MS}ms` : undefined,
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
          <Icon className="lift-kind" size={15} aria-hidden="true" data-testid="lift-kind" />
          <span className="lift-title">{title}</span>
          {onExpand ? (
            <button
              type="button"
              className="lift-icon"
              aria-label={LIFT_COPY.expand}
              title={LIFT_COPY.expand}
              onClick={() => finish(() => onExpand(rect))}
            >
              <Maximize2 size={15} aria-hidden="true" />
            </button>
          ) : null}
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
