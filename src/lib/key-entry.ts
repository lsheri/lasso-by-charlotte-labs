/**
 * Unit J1: an activation key handed out as a link (/j/<code>) survives sign
 * up and redeems at the first moment a workspace exists. Same storage rules
 * as the edu intent: storage is a convenience, never a requirement.
 */

export const KEY_STORAGE = "lasso.activation_key";
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
    window.localStorage.setItem(KEY_STORAGE, clean.toUpperCase());
  } catch {
    /* storage is a convenience, never a requirement */
  }
}

export function readActivationKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY_STORAGE) || null;
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
