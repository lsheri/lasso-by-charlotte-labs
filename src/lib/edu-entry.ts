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

/**
 * Pass 185: which front door someone came through. A marketing site links to
 * /auth?from=ceiba_uni, and that is the only signal there is, so it has to
 * survive the round trip through sign up before onboarding can act on it.
 */

const SOURCE_KEY = "lasso.signup_source";
const KNOWN_SOURCES = ["ceiba_uni", "edu", "direct"] as const;
export type SignupSource = (typeof KNOWN_SOURCES)[number];

export function markSignupSource(raw: unknown): void {
  if (typeof raw !== "string") return;
  if (!(KNOWN_SOURCES as readonly string[]).includes(raw)) return;
  try {
    window.localStorage.setItem(SOURCE_KEY, raw);
  } catch {
    /* storage is a convenience, never a requirement */
  }
}

export function readSignupSource(): SignupSource | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(SOURCE_KEY);
    if (value && (KNOWN_SOURCES as readonly string[]).includes(value)) {
      return value as SignupSource;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSignupSource(): void {
  try {
    window.localStorage.removeItem(SOURCE_KEY);
  } catch {
    /* nothing to clean up */
  }
}
