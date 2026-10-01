import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { afterResetDestination, resetRedirectTo, safeNext } from "../password-reset";
import { guardEventDims } from "../event-dim-allowlist";

describe("J3 password reset", () => {
  it("safeNext keeps only invite destinations", () => {
    expect(safeNext("/join?code=abc")).toBe("/join?code=abc");
    expect(safeNext("/home")).toBeNull();
    expect(safeNext("https://evil.example/join")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
  it("resetRedirectTo", () => {
    expect(resetRedirectTo("https://x.test", "/join?code=abc")).toBe("https://x.test/reset-password?next=%2Fjoin%3Fcode%3Dabc");
    expect(resetRedirectTo("https://x.test", null)).toBe("https://x.test/reset-password");
  });
  it("afterResetDestination", () => {
    expect(afterResetDestination("/join?code=abc")).toBe("/join?code=abc");
    expect(afterResetDestination("/home")).toBe("/home");
    expect(afterResetDestination(undefined)).toBe("/home");
  });
  it("source pins", () => {
    const auth = readFileSync("src/routes/auth.tsx", "utf8");
    expect(auth).toContain("FORGOT_LINK");
    expect(auth).toMatch(/mode === "signin" \? \(\s*<Link to="\/reset-password"[^]*?\{FORGOT_LINK\}/);
    const page = readFileSync("src/routes/reset-password.tsx", "utf8");
    for (const s of ["resetPasswordForEmail", "updateUser", "PASSWORD_RECOVERY", "RESET_SENT"]) expect(page).toContain(s);
    expect(page).not.toContain("beforeLoad");
  });
  it("dims", () => {
    expect(guardEventDims("auth.password_reset", { step: "requested", email: "x" }).dims).toEqual({ step: "requested" });
  });
});
