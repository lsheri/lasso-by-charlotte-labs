import { describe, expect, it } from "vitest";

import {
  REDEEM_REASONS,
  createRateLimiter,
  messageForReason,
  normalizeCode,
  type RedeemReason,
} from "@/lib/activation-keys";

// Compile-time exhaustiveness: adding a reason to the union without adding it
// to REDEEM_REASONS fails this assignment.
type Missing = Exclude<RedeemReason, (typeof REDEEM_REASONS)[number]>;
const _exhaustive: Missing extends never ? true : false = true;

describe("pass214 activation keys", () => {
  it("normalizeCode strips separators and upper-cases", () => {
    expect(normalizeCode("abc-123 xy")).toBe("ABC123XY");
    expect(normalizeCode("ABC123XY")).toBe("ABC123XY");
  });

  it("every reason has a distinct non-empty message", () => {
    expect(_exhaustive).toBe(true);
    const messages = REDEEM_REASONS.map(messageForReason);
    for (const m of messages) expect(m.trim().length).toBeGreaterThan(0);
    expect(new Set(messages).size).toBe(REDEEM_REASONS.length);
  });

  it("no message uses a banned word or an em dash", () => {
    const banned = ["score", "monitor", "track", "surveillance", "compliance", "fluency", "gaps", "caught"];
    for (const r of REDEEM_REASONS) {
      const m = messageForReason(r).toLowerCase();
      for (const w of banned) expect(m).not.toContain(w);
      expect(m).not.toContain("\u2014");
    }
  });

  it("rate limiter refuses the sixth attempt and allows again in a later window", () => {
    const allow = createRateLimiter(5, 60_000);
    for (let i = 0; i < 5; i++) expect(allow("u1", 1000 + i)).toBe(true);
    expect(allow("u1", 2000)).toBe(false);
    expect(allow("u2", 2000)).toBe(true);
    expect(allow("u1", 1000 + 60_001 + 5)).toBe(true);
  });
});
