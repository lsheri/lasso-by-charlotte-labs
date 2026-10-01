import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { guardEventDims } from "@/lib/event-dim-allowlist";
import { isExistingAccountSignup } from "@/lib/signup-existing";

const authSource = readFileSync(resolve(__dirname, "../../routes/auth.tsx"), "utf8");

describe("j1 · existing account signup", () => {
  it("is true for a placeholder user with no identities and no session", () => {
    expect(isExistingAccountSignup({ user: { identities: [] }, session: null }, null)).toBe(true);
  });

  it("is false when identities has an entry", () => {
    expect(isExistingAccountSignup({ user: { identities: [{ id: "x" }] }, session: null }, null)).toBe(false);
  });

  it("is false when a session is present", () => {
    expect(isExistingAccountSignup({ user: { identities: [] }, session: { access_token: "t" } }, null)).toBe(false);
  });

  it("is false when an error is set", () => {
    expect(isExistingAccountSignup({ user: { identities: [] }, session: null }, new Error("nope"))).toBe(false);
  });

  it("is false when user is null", () => {
    expect(isExistingAccountSignup({ user: null, session: null }, null)).toBe(false);
  });

  it("is false when identities is missing", () => {
    expect(isExistingAccountSignup({ user: {}, session: null }, null)).toBe(false);
  });

  it("auth.tsx checks for an existing account before noting the identity", () => {
    expect(authSource.indexOf("isExistingAccountSignup(")).toBeGreaterThan(-1);
    expect(authSource.indexOf("isExistingAccountSignup(")).toBeLessThan(authSource.indexOf("noteSignUpIdentity({ user: data.user"));
  });

  it("signup.existing_account keeps only the via dim", () => {
    expect(guardEventDims("signup.existing_account", { via: "invite", email: "x" }).dims).toEqual({ via: "invite" });
  });
});
