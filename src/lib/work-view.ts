/**
 * Which way the unmapped set is being looked at. Pile is the default on a first
 * visit; after that the person's own last choice is what they get back.
 */
export type WorkView = "pile" | "matrix";

export const WORK_VIEW_KEY = "lasso.work.view";

export function readWorkView(): WorkView {
  if (typeof window === "undefined") return "pile";
  try {
    const stored = window.localStorage.getItem(WORK_VIEW_KEY);
    return stored === "matrix" ? "matrix" : "pile";
  } catch {
    return "pile";
  }
}

export function writeWorkView(view: WorkView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORK_VIEW_KEY, view);
  } catch {
    /* private mode: the choice just does not persist */
  }
}
