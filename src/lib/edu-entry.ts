/**
 * The school entry door remembers itself across sign in. /join/edu marks the
 * intent, onboarding reads it once and stamps the workspace type at creation.
 */

const KEY = "lasso.edu_intent";

export function markEduIntent(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* storage is a convenience, never a requirement */
  }
}

export function readEduIntent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearEduIntent(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}
