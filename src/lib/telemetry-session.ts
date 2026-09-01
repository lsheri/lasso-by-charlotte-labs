/**
 * One id per browser session, plus a counter that only ever goes up. Both are
 * generated in the browser and passed through so the server can put events
 * back in order. Neither says anything about the person or the work.
 */

const STORAGE_KEY = "lasso.session_id";
let cached: string | null = null;
let seq = 0;

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sessionId(): string {
  if (cached) return cached;
  if (typeof window === "undefined") return (cached = randomId());
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) return (cached = stored);
    const next = randomId();
    window.sessionStorage.setItem(STORAGE_KEY, next);
    return (cached = next);
  } catch {
    return (cached = randomId());
  }
}

export function nextClientSeq(): number {
  seq += 1;
  return seq;
}

/** Test seam. */
export function resetTelemetrySession(): void {
  cached = null;
  seq = 0;
}
