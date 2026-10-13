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
