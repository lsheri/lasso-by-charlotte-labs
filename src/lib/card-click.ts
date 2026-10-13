/**
 * BI-1: what a click does on a board card or sticky. Pure, so the decisions
 * can be tested with plain objects instead of a rendered board.
 */
import { movedBeyondClick } from "@/lib/canvas-drag";

type Point = { x: number; y: number };

/** A clean single click on a card body toggles its Ask Lasso context. */
export function cardBodyClickSelects(input: {
  readOnly: boolean;
  /** event.detail: 1 for a first click, 2+ for the clicks of a double-click. */
  clickCount: number;
  down: Point | null;
  up: Point;
  /** The click landed on a button, link or field inside the card. */
  onControl: boolean;
}): boolean {
  if (input.readOnly || input.onControl || input.clickCount !== 1) return false;
  if (!input.down) return false;
  return !movedBeyondClick(input.down, input.up);
}

/** A clean double-click opens any card, and undoes the select its first click made. */
export function cardDoubleClick(input: {
  readOnly: boolean;
  moved: boolean;
  onControl: boolean;
  firstClickSelected: boolean;
}): { open: boolean; undoSelect: boolean } {
  if (input.readOnly || input.moved || input.onControl) return { open: false, undoSelect: false };
  return { open: true, undoSelect: input.firstClickSelected };
}

export type StickyEditTrigger = "click" | "doubleClick" | "pencil";

/** Single clicks never start editing a sticky; double-click and the pencil do. */
export function stickyTriggerEntersEdit(trigger: StickyEditTrigger, editable: boolean): boolean {
  if (!editable) return false;
  return trigger === "doubleClick" || trigger === "pencil";
}

/** A brand-new empty sticky that is selected takes typing straight away. */
export function stickyStartsEditing(input: { selected: boolean; editable: boolean; textLength: number }): boolean {
  return input.selected && input.editable && input.textLength === 0;
}

/**
 * BI-2a: how a card's context toggle reaches the page. One person act writes
 * at most one context event, so a double-click writes none.
 * - menu: toggle and record "menu" (the card menu item, unchanged)
 * - card-click: toggle now, record nothing yet
 * - card-confirm: no toggle, record "card" once the double-click window has passed
 * - card-undo: toggle back silently; the pending "card" event is never sent
 */
export type CardSelectVia = "menu" | "card-click" | "card-confirm" | "card-undo";

export function cardContextCall(via: CardSelectVia): { toggle: boolean; record: "menu" | "card" | null } {
  switch (via) {
    case "menu": return { toggle: true, record: "menu" };
    case "card-click": return { toggle: true, record: null };
    case "card-confirm": return { toggle: false, record: "card" };
    case "card-undo": return { toggle: true, record: null };
  }
}

/** Long enough to cover a double-click; only the event waits, never the selection. */
export const CARD_CONFIRM_MS = 400;

export function createCardClickController<Id>(deps: {
  select: (via: CardSelectVia) => void;
  schedule: (run: () => void, ms: number) => Id;
  cancel: (id: Id) => void;
}) {
  let timer: { id: Id } | null = null;
  const confirm = () => { timer = null; deps.select("card-confirm"); };
  return {
    /** A clean single click: select at once, record later unless a double-click follows. */
    click() {
      if (timer) { deps.cancel(timer.id); confirm(); }
      deps.select("card-click");
      timer = { id: deps.schedule(confirm, CARD_CONFIRM_MS) };
    },
    /** True while a first click's event is still waiting. */
    pending: () => timer !== null,
    /** A double-click: drop the waiting event and silently undo the first click's select. */
    undo() {
      if (!timer) return;
      deps.cancel(timer.id);
      timer = null;
      deps.select("card-undo");
    },
    /** Unmount: send a waiting event rather than lose it. */
    flush() { if (timer) { deps.cancel(timer.id); confirm(); } },
  };
}
