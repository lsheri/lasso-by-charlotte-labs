export type AnchorBox = { top: number; left: number; width: number; height: number };

/** What counts as an open dialog: a dialog or a confirm that Radix marks open. */
export const OPEN_DIALOG = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

/** The surface's box on screen, or null when it is not on the page, has no size, or a dialog is open over it. */
export function measureAnchor(testId: string, root: ParentNode = document): AnchorBox | null {
  // An open dialog covers the surface, so an outline drawn over the dialog would point at nothing.
  if (root.querySelector(OPEN_DIALOG)) return null;
  const target = root.querySelector(`[data-testid="${CSS.escape(testId)}"]`);
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}
