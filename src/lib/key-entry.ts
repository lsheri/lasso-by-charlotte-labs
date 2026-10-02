/**
 * Unit J1: an activation key handed out as a link (/j/<code>) survives sign
 * up and redeems at the first moment a workspace exists. Same storage rules
 * as the edu intent: storage is a convenience, never a requirement.
 *
 * KX1: the saved key expires after one hour, so a link clicked weeks ago can
 * never attach a later account. A legacy bare-string value is treated as
 * expired and cleared.
 */

export const KEY_STORAGE = "lasso.activation_key";
export const KEY_TTL_MS = 60 * 60 * 1000;
const MAX_KEY_LENGTH = 200;

/** Trimmed code, or null when empty or longer than the limit. */
export function cleanActivationKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_KEY_LENGTH) return null;
  return trimmed;
}

export function markActivationKey(code: string | undefined): void {
  const clean = cleanActivationKey(code);
  if (!clean) return;
  try {
    window.localStorage.setItem(
      KEY_STORAGE,
      JSON.stringify({ code: clean.toUpperCase(), savedAt: Date.now() }),
    );
  } catch {
    /* storage is a convenience, never a requirement */
  }
}

export function readActivationKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_STORAGE);
    if (!raw) return null;
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const entry = parsed as { code?: unknown; savedAt?: unknown } | null;
    const code = entry && typeof entry === "object" ? cleanActivationKey(entry.code) : null;
    const savedAt = entry && typeof entry === "object" ? entry.savedAt : null;
    if (!code || typeof savedAt !== "number" || !Number.isFinite(savedAt) || Date.now() - savedAt > KEY_TTL_MS) {
      clearActivationKey();
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearActivationKey(): void {
  try {
    window.localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* nothing to clean up */
  }
}
