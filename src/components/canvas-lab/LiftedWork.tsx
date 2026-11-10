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
  MessageSquare,
  MessagesSquare,
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
import { brandHex, type BrandKey } from "@/components/connectors/BrandLogo";
import { LiftedWorkHead, type LiftMenuItem } from "@/components/canvas-lab/LiftedWorkHead";

export const LIFT_COPY = {
  compress: "Back to the board",
  move: "Move this view",
  resize: (corner: LiftCorner) => `Resize from ${corner}`,
} as const;

const CORNERS: readonly LiftCorner[] = ["nw", "ne", "se", "sw"];

export type LiftPanel = { id: string; label: string; render: () => ReactNode };
/** T2b: the side panel's width and its tab rail's, taken off the work's own width when they show. */
export const LIFT_SIDE = { panel: 300, rail: 40 } as const;

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

/** Arrows inside a field move the caret, never the view. */
function typingIn(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}

/** The side panel (Trail, Comments) keeps its own keys: an arrow there never steps away. */
function inSidePanel(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(".lift-side"));
}

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
 * board (or Esc, or a press on the dimmed board) morphs it home.
 *
 * T2a (one view, 9 Nov, Liam): there is no fuller view to expand into. Every piece of work has this one
 * view, from a double-click, the card's Open button or its menu. The header says which tool the work lives
 * in and opens it there; anything else lives in the "More" menu.
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
  brand = null,
  dateLine = null,
  openUrl = null,
  menu = [],
  panels = [],
  initialPanel = null,
  onPanelOpened,
  onStep,
  closeTo,
  animateOpen = true,
  bodyRef,
  railFoot,
  children,
}: {
  title: string;
  kind: LiftKind;
  /** The card's box on screen when it was lifted; the view grows out of it and shrinks back into it. */
  origin: LiftRect | null;
  returnFocusTo?: (() => HTMLElement | null) | undefined;
  onClose: () => void;
  /** Where the work lives. Null for a picture or anything with no known tool. */
  brand?: BrandKey | null | undefined;
  /** "Captured Oct 14" and the like: when the work was made or brought in. Never who did it. */
  dateLine?: string | null | undefined;
  /** The work in its own tool. Only https links are drawn. */
  openUrl?: string | null | undefined;
  /** Everything that is not reading the work: continue it elsewhere, its ledger, and so on. */
  menu?: LiftMenuItem[] | undefined;
  /** T2b: side panels beside the work (the Trail first), closed until asked for. */
  panels?: LiftPanel[] | undefined;
  onPanelOpened?: ((id: string) => void) | undefined;
  /** Opened from another piece's trail: the trail stays open on the piece it led to. */
  initialPanel?: string | null | undefined;
  /** T3: move to the previous (-1) or next (1) piece; the open panel goes with it. */
  onStep?: ((direction: 1 | -1, panel: string | null) => void) | undefined;
  /**
   * Where the work sits on the board right now, read when the view closes, so it always shrinks back into
   * its own card (Liam, 9 Nov: "a morph from area clicked both to open and when it closes").
   */
  closeTo?: (() => LiftRect | null) | undefined;
  /** False when reached by the arrows or the trail: it appears in place, and still closes into its card. */
  animateOpen?: boolean | undefined;
  /** S2: the scrolling body, for anything drawn on the work itself (stickies). */
  bodyRef?: ((el: HTMLDivElement | null) => void) | undefined;
  /** S2: sits at the foot of the tab rail (the sticky pad). */
  railFoot?: ReactNode | undefined;
  children: (bodyWidth: number) => ReactNode;
}) {
  const still = useRef(reducedMotion()).current;
  const animate = Boolean(origin) && !still && animateOpen;
  const [rect, setRect] = useState<LiftRect>(() => liftOpenRect(viewport()));
  const [phase, setPhase] = useState<LiftPhase>(animate ? "from" : "open");
  /** The card's box the view shrinks into on close; the opening box until then. */
  const [homeRect, setHomeRect] = useState<LiftRect | null>(origin);
  const gesture = useRef<Gesture | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finished = useRef(false);
  const Icon = LIFT_KIND_ICON[kind];
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<string | null>(initialPanel);
  const openPanel = panels.find((entry) => entry.id === panel) ?? null;
  const bodyWidth = rect.width - (panels.length || railFoot ? LIFT_SIDE.rail : 0) - (openPanel ? LIFT_SIDE.panel : 0);
  // LIFT-6: the page passes fresh callbacks on every render. Held in refs, so a board redraw in the middle
  // of a close (a live push, presence) can never cancel the close timer and leave an invisible layer up.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const returnFocusRef = useRef(returnFocusTo);
  returnFocusRef.current = returnFocusTo;
  const closeToRef = useRef(closeTo);
  closeToRef.current = closeTo;

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
      returnFocusRef.current?.()?.focus({ preventScroll: true });
    },
    [],
  );

  function finish(after: () => void) {
    if (finished.current) return;
    finished.current = true;
    after();
  }

  function close() {
    if (phase === "closing") return;
    const home = closeToRef.current?.() ?? origin;
    if (still || !home) {
      finish(() => onCloseRef.current());
      return;
    }
    setHomeRect(home);
    setPhase("closing");
    closeTimer.current = setTimeout(() => finish(() => onCloseRef.current()), LIFT_MORPH_MS);
  }

  // Esc closes from anywhere while the view is up, before the board's own Esc can clear its selection.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // T3: left and right move to the previous or next piece on the board, without closing the view.
      const plain = !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey;
      // Shift with an arrow grows a text selection in the work; only a plain arrow steps.
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && plain && onStep && !menuOpen && !typingIn(event.target) && !inSidePanel(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onStep(event.key === "ArrowRight" ? 1 : -1, panel);
        return;
      }
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // S2: an open sticky takes the first Esc (it cancels what was being written), then the view.
      const layer = panelRef.current?.querySelector("[data-lift-esc]");
      if (layer) {
        layer.dispatchEvent(new CustomEvent("lift-esc"));
        return;
      }
      // T2c-1: Esc in a comment leaves the field and keeps the draft; the next Esc closes the view.
      if (typingIn(event.target) && event.target instanceof HTMLElement) {
        // Focus stays in the side panel, where arrows never step away from a draft.
        const side = event.target.closest<HTMLElement>(".lift-side");
        event.target.blur();
        side?.focus();
        return;
      }
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      close();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  function beginMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || phase !== "open") return;
    if ((event.target as Element).closest("button, a, [role='menu']")) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer is already gone */
    }
    gesture.current = { kind: "move", start: rect, x: event.clientX, y: event.clientY };
  }

  function beginResize(corner: LiftCorner, event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || phase !== "open") return;
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
    // Never re-aim the box while it is shrinking home.
    if (phase === "closing") {
      gesture.current = null;
      return;
    }
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
          transform: phase !== "open" && homeRect ? liftFlip(homeRect, rect) : undefined,
          transitionDuration: still ? undefined : `${LIFT_MORPH_MS}ms`,
          ["--lift-brand" as string]: brand && brand !== "unknown" ? brandHex(brand) : undefined,
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
          <LiftedWorkHead
            title={title}
            icon={Icon}
            brand={brand}
            dateLine={dateLine}
            openUrl={openUrl}
            menu={menu}
            menuOpen={menuOpen}
            onMenuOpenChange={setMenuOpen}
            onBack={close}
          />
        </header>
        <div className="lift-main">
          <div ref={bodyRef} className="lift-body" data-testid="lift-body" onPointerDown={() => setMenuOpen(false)}>
            {children(bodyWidth)}
          </div>
          {openPanel ? (
            <aside className="lift-side" data-testid="lift-side" aria-label={openPanel.label} tabIndex={-1} style={{ width: LIFT_SIDE.panel }}>
              {openPanel.render()}
            </aside>
          ) : null}
          {panels.length || railFoot ? (
            <div className="lift-tabs" role="tablist" aria-orientation="vertical" style={{ width: LIFT_SIDE.rail }}>
              {panels.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  className="lift-tab"
                  aria-selected={panel === entry.id}
                  onClick={() => {
                    const next = panel === entry.id ? null : entry.id;
                    setPanel(next);
                    if (next) onPanelOpened?.(next);
                  }}
                >
                  {entry.label}
                </button>
              ))}
              {railFoot ? <div className="lift-rail-foot">{railFoot}</div> : null}
            </div>
          ) : null}
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
