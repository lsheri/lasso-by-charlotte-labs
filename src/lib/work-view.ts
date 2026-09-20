/** How work cards are drawn. The four-column layout never changes. */
export type WorkView = "preview" | "sticky";

export const WORK_VIEW_KEY = "lasso.work.view";

export function readWorkView(): WorkView {
  if (typeof window === "undefined") return "preview";
  try {
    const stored = window.localStorage.getItem(WORK_VIEW_KEY);
    return stored === "sticky" ? "sticky" : "preview";
  } catch {
    return "preview";
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
