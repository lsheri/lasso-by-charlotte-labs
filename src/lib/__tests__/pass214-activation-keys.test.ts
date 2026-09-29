import { describe, expect, it } from "vitest";

import {
  REDEEM_REASONS,
  createRateLimiter,
  messageForReason,
  normalizeCode,
  type RedeemReason,
} from "@/lib/activation-keys";
import { chooseProfile } from "@/lib/activation-keys.functions";

const owned = { id: "p-1", org_id: "o-1" };
const other = { id: "p-2", org_id: "o-2" };

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

  it("chooseProfile uses a supplied profile id that belongs to the caller", () => {
    expect(chooseProfile("p-1", owned, false)).toEqual({ action: "use", profile: owned });
  });

  it("chooseProfile refuses a supplied profile id that does not belong to the caller, never falling back", () => {
    expect(chooseProfile("p-1", other, false)).toEqual({ action: "refuse" });
    expect(chooseProfile("p-1", null, false)).toEqual({ action: "refuse" });
    expect(chooseProfile("p-1", owned, true)).toEqual({ action: "refuse" });
  });

  it("chooseProfile falls back to the oldest profile when none is supplied", () => {
    expect(chooseProfile(undefined, other, false)).toEqual({ action: "use", profile: other });
    expect(chooseProfile(undefined, other, true)).toEqual({ action: "refuse" });
  });

  it("chooseProfile returns none when no id is supplied and the caller has no profile", () => {
    expect(chooseProfile(undefined, null, false)).toEqual({ action: "none" });
  });

  it("chooseProfile still refuses a mismatched supplied id, with or without an owned profile", () => {
    expect(chooseProfile("p-1", other, false)).toEqual({ action: "refuse" });
    expect(chooseProfile("p-1", null, false)).toEqual({ action: "refuse" });
  });

  it("chooseProfile refuses on query failure even when owned is null", () => {
    expect(chooseProfile(undefined, null, true)).toEqual({ action: "refuse" });
  });

  it("the two database-only reasons are known and carry messages", () => {
    expect(REDEEM_REASONS).toContain("partner_target");
    expect(REDEEM_REASONS).toContain("needs_workspace");
    expect(messageForReason("partner_target").trim().length).toBeGreaterThan(0);
    expect(messageForReason("needs_workspace").trim().length).toBeGreaterThan(0);
  });
});
