/**
 * LIFT-1 (L1): a press on the body of a file piece moves it like any card. Two presses still stay
 * with the piece: one on a control (the add buttons, the hidden file input, a link), and one that is
 * not inside the piece's own box at all, which is a press in the Drive picker: it opens in a portal,
 * and React still carries its presses up to the card, where they would start a drag.
 */
export function referenceBodyPressDrags(card: Element, target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (!card.contains(target)) return false;
  return !target.closest("button, a, input, select, textarea, label, [role='menu'], [role='menuitem'], [role='dialog']");
}
