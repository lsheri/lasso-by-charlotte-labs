export type RedeemReason =
  | "not_found"
  | "revoked"
  | "expired"
  | "exhausted"
  | "redeemed"
  | "already_redeemed"
  | "rate_limited"
  | "error";

export type RedeemOutcome = { ok: boolean; reason: RedeemReason; message: string };

export const REDEEM_REASONS: readonly RedeemReason[] = [
  "not_found",
  "revoked",
  "expired",
  "exhausted",
  "redeemed",
  "already_redeemed",
  "rate_limited",
  "error",
];

const MESSAGES: Record<RedeemReason, string> = {
  not_found: "We did not recognise that key. Check it and try again.",
  revoked: "That key is no longer active.",
  expired: "That key has expired.",
  exhausted: "That key has already been used the number of times it allows.",
  redeemed: "Key accepted. Your workspace is now linked.",
  already_redeemed: "You have already used this key. Your workspace is linked.",
  rate_limited: "Too many tries. Wait a minute and try again.",
  error: "Something went wrong. Try again in a moment.",
};

export function messageForReason(reason: RedeemReason): string {
  return MESSAGES[reason];
}

export function isRedeemReason(value: unknown): value is RedeemReason {
  return typeof value === "string" && (REDEEM_REASONS as readonly string[]).includes(value);
}

/**
 * Display only. Mirrors the database's normalisation so the client can show a
 * tidy value. This is NOT the security boundary: the database normalises the
 * code independently inside redeem_activation_key.
 */
export function normalizeCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/**
 * Best-effort, in-memory limiter. It is per instance and resets on redeploy or
 * when the worker is recycled, so it only slows casual guessing. A durable
 * limiter would need a table. The real defence is that codes are high entropy.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now: number = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}
