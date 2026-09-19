/**
 * Pass 175b: the browser-side timing rule for the invisible sweep nudge.
 * Pure so it can be reasoned about and tested without a browser.
 */

export const EGRESS_NUDGE_KEY = "lasso.egress_nudged_at";
export const EGRESS_NUDGE_INTERVAL_MS = 10 * 60 * 1000;

/** True when enough time has passed since the last nudge in this browser. */
export function shouldNudgeEgress(
  lastNudgedAt: string | number | null | undefined,
  now: number,
  intervalMs: number = EGRESS_NUDGE_INTERVAL_MS,
): boolean {
  if (lastNudgedAt === null || lastNudgedAt === undefined || lastNudgedAt === "") return true;
  const last = typeof lastNudgedAt === "number" ? lastNudgedAt : Number(lastNudgedAt);
  if (!Number.isFinite(last)) return true;
  return now - last >= intervalMs;
}
