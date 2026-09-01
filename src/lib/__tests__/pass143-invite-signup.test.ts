import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderInviteEmail, inviteSubject, MAIL_FOOTER } from "@/lib/invite-email";
import {
  SIGNUP_NO_INVITE_LINE,
  evaluateSignupInvite,
  normalizeEmail,
  type SignupInviteRow,
} from "@/lib/signup-invite";

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

const BANNED = [
  "score",
  "monitor",
  "track",
  "surveillance",
  "oversight",
  "governance",
  "compliance",
  "integrity",
  "fluency",
  "deficiencies",
  "caught",
];

function invite(over: Partial<SignupInviteRow> = {}): SignupInviteRow {
  return {
    code: "a1b2c3d4e5f6",
    email: "New.Person@Firm.com",
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    used_at: null,
    revoked_at: null,
    ...over,
  };
}

describe("signup invite validator", () => {
  it("refuses an org join with no invite at all", () => {
    const result = evaluateSignupInvite(null, "someone@firm.com");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("missing");
    expect(result.ok === false && result.message).toBe(SIGNUP_NO_INVITE_LINE);
  });

  it("scopes the no invite line to joining an organization", () => {
    expect(SIGNUP_NO_INVITE_LINE).toBe(
      "Joining an organization needs an invite. Ask your organization admin for one.",
    );
  });


  it("refuses an expired invite", () => {
    const past = invite({ expires_at: new Date(Date.now() - 1000).toISOString() });
    expect(evaluateSignupInvite(past, "new.person@firm.com").ok).toBe(false);
    expect(
      evaluateSignupInvite(past, "new.person@firm.com").ok === false &&
        evaluateSignupInvite(past, "new.person@firm.com"),
    ).toMatchObject({ reason: "expired" });
  });

  it("refuses a withdrawn invite", () => {
    const result = evaluateSignupInvite(
      invite({ revoked_at: new Date().toISOString() }),
      "new.person@firm.com",
    );
    expect(result).toMatchObject({ ok: false, reason: "revoked" });
  });

  it("refuses an invite that was already accepted", () => {
    const result = evaluateSignupInvite(
      invite({ used_at: new Date().toISOString() }),
      "new.person@firm.com",
    );
    expect(result).toMatchObject({ ok: false, reason: "used" });
  });

  it("refuses a different address than the one invited", () => {
    const result = evaluateSignupInvite(invite(), "someone.else@firm.com");
    expect(result).toMatchObject({ ok: false, reason: "mismatch" });
  });

  it("accepts the invited address whatever the casing", () => {
    const result = evaluateSignupInvite(invite(), "NEW.PERSON@firm.com", new Date(), "Acme");
    expect(result.ok).toBe(true);
    expect(result.ok && result.org_name).toBe("Acme");
  });

  it("answers about the code alone before an address is typed", () => {
    expect(evaluateSignupInvite(invite(), null).ok).toBe(true);
  });

  it("normalizes addresses the same way everywhere", () => {
    expect(normalizeEmail("  Person@Firm.COM ")).toBe("person@firm.com");
  });
});

describe("invite email", () => {
  const mail = renderInviteEmail({
    inviterName: "Dana Reed",
    orgName: "Acme Partners",
    acceptUrl: "https://lasso.charlotte-labs.com/join?code=a1b2c3d4e5f6",
  });

  it("names the organization in the subject", () => {
    expect(mail.subject).toBe("You are invited to Acme Partners");
    expect(inviteSubject("Dana Reed", "Acme Partners")).toBe(mail.subject);
    expect(inviteSubject("Dana Reed", "")).toBe("You are invited");
  });

  it("carries the accept link in both parts, with the branded button", () => {
    expect(mail.html).toContain("https://lasso.charlotte-labs.com/join?code=a1b2c3d4e5f6");
    expect(mail.html).toContain("Accept your invite");
    expect(mail.html).toContain("#12653d");
    expect(mail.html).toContain("#fafafa");
    expect(mail.html).toContain("BY CHARLOTTE LABS");
    expect(mail.html).toContain("https://charlotte-labs.com/email/lasso-mark.gif");
    expect(mail.html).not.toContain("background:#111413");
    expect(mail.text).toContain("https://lasso.charlotte-labs.com/join?code=a1b2c3d4e5f6");
    expect(mail.html).toContain(MAIL_FOOTER);
  });

  it("wears the shared notebook chrome", () => {
    expect(mail.html).toContain("LASSO");
    expect(mail.html).toContain("'Caveat', 'Segoe Script', 'Bradley Hand', cursive");
    expect(mail.html).toContain("dm-btn");
  });

  it("keeps the copy plain, with no banned words and no em dashes", () => {
    const copy = `${mail.subject} ${mail.text}`.toLowerCase();
    for (const word of BANNED) expect(copy).not.toContain(word);
    expect(mail.text).not.toContain("—");
  });
});

describe("server side gates", () => {
  it("keeps invite creation admin only in the server function", () => {
    const fn = read("lib/invites.functions.ts");
    expect(fn).toContain('if (profile.role !== "admin" || row?.deactivated_at)');
    expect(fn).toContain("checkSignupInvite");
  });

  it("revalidates the invite on the server when a coded signup is submitted", () => {
    const page = read("routes/auth.tsx");
    expect(page).toContain("const verdict = await checkInvite({ data: { code: inviteCode, email } })");
  });

  it("leaves account creation open when no invite code is present", () => {
    const page = read("routes/auth.tsx");
    // No blanket wall, no disabled submit, no validator call off the code path.
    expect(page).not.toContain("SIGNUP_NO_INVITE_LINE");
    expect(page).not.toContain('mode === "signup" && !inviteCode');
    expect(page).toContain("disabled={pending}");
    expect(page).toContain("if (inviteCode) {");
    expect(page).toContain("Create your account, then set up your workspace or join your team.");
    expect(page).toContain("${window.location.origin}${onboardingPath}");
  });


  it("falls back to a copyable link when the email key is missing", () => {
    const server = read("lib/invites.server.ts");
    expect(server).toContain('return { sent: false, reason: "not_configured", message: null }');
    const dialog = read("components/invites/InviteDialog.tsx");
    expect(dialog).toContain("Email sending is not set up yet. Share this link directly.");
    expect(dialog).toContain("Copy link");
  });
});
