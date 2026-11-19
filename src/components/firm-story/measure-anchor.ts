export type AnchorBox = { top: number; left: number; width: number; height: number };

/** Anything that says it is a dialog or a confirm. Whether it is open is decided by isOpenDialog. */
export const ANY_DIALOG = '[role="dialog"], [role="alertdialog"]';

function shown(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.hasAttribute("hidden") || getComputedStyle(node).display === "none") return false;
  }
  return true;
}

/**
 * Open means: the shared dialogs, confirms, sheets and drawers mark themselves with data-state, so that is their
 * answer. A dialog built by hand has no data-state; it is open while it is in the page and not hidden (Settings
 * stays in the page, hidden, after its first use).
 */
export function isOpenDialog(element: Element): boolean {
  const state = element.getAttribute("data-state");
  return state === null ? shown(element) : state === "open";
}

export function anyDialogOpen(root: ParentNode = document): boolean {
  return [...root.querySelectorAll(ANY_DIALOG)].some(isOpenDialog);
}

/** The surface's box on screen, or null when it is not on the page, has no size, or a dialog is open over it. */
export function measureAnchor(testId: string, root: ParentNode = document): AnchorBox | null {
  // An open dialog covers the surface, so an outline drawn over the dialog would point at nothing.
  if (anyDialogOpen(root)) return null;
  const target = root.querySelector(`[data-testid="${CSS.escape(testId)}"]`);
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}
