import { describe, expect, it } from "vitest";

import {
  blockedStateFor,
  blockedStateFromRpcError,
  emailsMatch,
  maskEmail,
  normalizeEmail,
  notFoundState,
  resolveInviteStatus,
  type InviteState,
} from "../invite-state";

const NOW = new Date("2026-08-19T00:00:00Z");
const FUTURE = "2026-09-19T00:00:00Z";
const PAST = "2026-08-01T00:00:00Z";

describe("resolveInviteStatus", () => {
  it("returns ok for a live invite", () => {
    expect(
      resolveInviteStatus({ revoked_at: null, used_at: null, expires_at: FUTURE }, NOW),
    ).toBe("ok");
  });

  it("ranks revoked above used and expired", () => {
    expect(
      resolveInviteStatus({ revoked_at: PAST, used_at: PAST, expires_at: PAST }, NOW),
    ).toBe("revoked");
  });

  it("ranks used above expired", () => {
    expect(
      resolveInviteStatus({ revoked_at: null, used_at: PAST, expires_at: PAST }, NOW),
    ).toBe("used");
  });

  it("expires on the boundary", () => {
    expect(
      resolveInviteStatus(
        { revoked_at: null, used_at: null, expires_at: NOW.toISOString() },
        NOW,
      ),
    ).toBe("expired");
  });
});

describe("emailsMatch", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(emailsMatch(" Alex@Firm.com ", "alex@firm.com")).toBe(true);
  });

  it("rejects different addresses", () => {
    expect(emailsMatch("alex@firm.com", "sam@firm.com")).toBe(false);
  });

  it("treats empty as no match", () => {
    expect(emailsMatch(null, null)).toBe(false);
    expect(emailsMatch("", "")).toBe(false);
    expect(emailsMatch("  ", "alex@firm.com")).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  A@B.CO ")).toBe("a@b.co");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("maskEmail", () => {
  it("keeps the first character and the domain", () => {
    expect(maskEmail("alex@firm.com")).toBe("a•••@firm.com");
  });

  it("returns null when there is nothing to mask", () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail("@firm.com")).toBeNull();
    expect(maskEmail("not-an-email")).toBeNull();
  });
});

function state(overrides: Partial<InviteState>): InviteState {
  return {
    ...notFoundState(true),
    status: "ok",
    invited_role: "coach",
    org_name: "Charlotte Labs",
    ...overrides,
  };
}

describe("blockedStateFor", () => {
  it("reports mismatch when the signed in email differs", () => {
    const s = state({
      is_email_bound: true,
      email: "alex@firm.com",
      viewer: { signed_in: true, is_member: false },
    });
    expect(blockedStateFor(s, "sam@firm.com")).toBe("mismatch");
    expect(blockedStateFor(s, "ALEX@firm.com")).toBeNull();
  });

  it("reports already_member before any email comparison", () => {
    const s = state({
      is_email_bound: true,
      email: "alex@firm.com",
      viewer: { signed_in: true, is_member: true },
    });
    expect(blockedStateFor(s, "sam@firm.com")).toBe("already_member");
  });

  it("never blocks a signed out viewer", () => {
    const s = state({
      is_email_bound: true,
      email: null,
      email_hint: "a•••@firm.com",
      viewer: { signed_in: false, is_member: false },
    });
    expect(blockedStateFor(s, null)).toBeNull();
  });

  it("passes through lifecycle states", () => {
    expect(blockedStateFor(state({ status: "revoked" }), null)).toBe("revoked");
    expect(blockedStateFor(state({ status: "used" }), null)).toBe("used");
    expect(blockedStateFor(state({ status: "expired" }), null)).toBe("expired");
    expect(blockedStateFor(notFoundState(false), null)).toBeNull();
  });
});

describe("blockedStateFromRpcError", () => {
  it("maps the three raised messages", () => {
    expect(blockedStateFromRpcError("already a member of this organization")).toBe(
      "already_member",
    );
    expect(blockedStateFromRpcError("this invite was issued to a different email address")).toBe(
      "mismatch",
    );
    expect(blockedStateFromRpcError("invalid or expired invite")).toBe("expired");
    expect(blockedStateFromRpcError("a company email address is required")).toBeNull();
  });
});
