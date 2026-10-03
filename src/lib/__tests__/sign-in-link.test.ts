import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { CANONICAL_ORIGIN } from "@/lib/app-host";
import { isSendCooldown, SIGN_IN_LINK_COPY, signInLinkOptions, signInLinkRedirect } from "@/lib/sign-in-link";

describe("passwordless sign-in link", () => {
  it("never creates an account", () => {
    expect(signInLinkOptions("").shouldCreateUser).toBe(false);
    expect(readFileSync("src/routes/auth.tsx", "utf8")).toContain("signInLinkOptions(window.location.search)");
  });

  it("returns to CANONICAL_ORIGIN", () => {
    const url = new URL(signInLinkOptions("").emailRedirectTo);
    expect(url.origin).toBe(CANONICAL_ORIGIN);
    expect(signInLinkRedirect("")).toBe(`${CANONICAL_ORIGIN}/auth`);
  });

  it("keeps intent and key, and the rest of the query", () => {
    const url = new URL(signInLinkRedirect("?intent=seat&key=LSO-TESTAA&next=%2Fjoin%3Fcode%3DX"));
    expect(url.searchParams.get("intent")).toBe("seat");
    expect(url.searchParams.get("key")).toBe("LSO-TESTAA");
    expect(url.searchParams.get("next")).toBe("/join?code=X");
  });

  it("reads the send cooldown calmly", () => {
    expect(isSendCooldown({ status: 429, message: "x" })).toBe(true);
    expect(isSendCooldown({ message: "For security purposes, you can only request this after 42 seconds." })).toBe(true);
    expect(isSendCooldown({ status: 422, message: "Signups not allowed for otp" })).toBe(false);
    expect(isSendCooldown(null)).toBe(false);
  });

  it("copy has no em dash and says the link works once", () => {
    for (const v of Object.values(SIGN_IN_LINK_COPY)) expect(v).not.toContain("\u2014");
    expect(SIGN_IN_LINK_COPY.sentBody).toContain("works once");
  });
});
