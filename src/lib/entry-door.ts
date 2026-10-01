/**
 * Unit S2: the signed-out logo goes back to the door someone came in through.
 *
 * The destination is looked up from a closed, hardcoded map keyed by the
 * existing FunnelSource list. Nothing the visitor supplies is ever used as a
 * URL: the stored value is only a key, and an unknown key means Lasso's "/".
 */
import { parseFunnelSource, type FunnelSource } from "@/lib/funnel-source";

export const ENTRY_DOOR_KEY = "lasso.entry_door";

export const LASSO_HOME = "/";

/** The only places the logo may send someone. Unlisted sources go to "/". */
export const ENTRY_DOOR_DESTINATIONS: Readonly<Partial<Record<FunnelSource, string>>> = {
  front_door: "https://charlotte-labs.com",
  edu_landing: "https://edu.charlotte-labs.com",
};

export function rememberEntryDoor(src: unknown): void {
  const parsed = parseFunnelSource(src);
  if (!parsed) return;
  try {
    window.localStorage.setItem(ENTRY_DOOR_KEY, parsed);
  } catch {
    /* storage is a convenience, never a requirement */
  }
}

export function readEntryDoor(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ENTRY_DOOR_KEY);
  } catch {
    return null;
  }
}

export function resolveEntryDoorHref(stored: string | null): string {
  if (!stored) return LASSO_HOME;
  if (!Object.prototype.hasOwnProperty.call(ENTRY_DOOR_DESTINATIONS, stored)) return LASSO_HOME;
  return ENTRY_DOOR_DESTINATIONS[stored as FunnelSource] ?? LASSO_HOME;
}
