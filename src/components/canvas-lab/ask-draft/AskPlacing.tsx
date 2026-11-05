import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * ASK-D2: placing a pin by hand. Draft-only. When nothing is armed every
 * function here returns straight away, so the board's own press handling
 * runs exactly as before.
 */
type Point = { x: number; y: number };
type Armed = { onPlace: (at: Point) => void };

let armed: Armed | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export const PLACING_COPY = { hint: "Click the board to put it down" };

export function armAskPlacing(next: Armed): void { armed = next; emit(); }
export function cancelAskPlacing(): void { if (!armed) return; armed = null; emit(); }
export function isAskPlacingArmed(): boolean { return armed !== null; }

/**
 * The single hook into the board shell's press. Returns false at once when
 * nothing is armed. When armed, a left press puts the pin down and the press
 * goes no further, so no pan, marquee or card drag starts.
 */
export function consumeAskPlacingPress(
  event: { button: number; target: EventTarget | null; clientX: number; clientY: number; preventDefault: () => void; stopPropagation: () => void },
  toBoard: (clientX: number, clientY: number) => Point,
): boolean {
  if (!armed) return false;
  if (event.button !== 0) return false;
  if (event.target instanceof Element && event.target.closest(".canvas-lab-floating-tools")) return false;
  event.preventDefault();
  event.stopPropagation();
  const current = armed;
  armed = null;
  emit();
  current.onPlace(toBoard(event.clientX, event.clientY));
  return true;
}

export function useAskPlacingArmed(): boolean {
  return useSyncExternalStore(subscribe, () => armed !== null, () => false);
}

/** The ghost that follows the pointer while armed. Esc cancels. Unmounting cancels. */
export function AskPlacingGhost({ host }: { host: HTMLElement }) {
  const isArmed = useAskPlacingArmed();
  const [at, setAt] = useState<Point | null>(null);

  useEffect(() => () => cancelAskPlacing(), []);

  useEffect(() => {
    if (!isArmed) { setAt(null); return; }
    const move = (event: PointerEvent) => {
      const r = host.getBoundingClientRect();
      const inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
      setAt(inside ? { x: event.clientX - r.left, y: event.clientY - r.top } : null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelAskPlacing();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("keydown", key, true); };
  }, [isArmed, host]);

  if (!isArmed || !at) return null;
  return createPortal(
    <div className="ask-draft-ghost" aria-hidden="true" style={{ left: at.x, top: at.y }}>
      <span>{PLACING_COPY.hint}</span>
    </div>,
    host,
  );
}
